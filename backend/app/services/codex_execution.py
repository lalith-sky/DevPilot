import json
import os
import re
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4

from app.models.platform import TaskExecutionResponse
from app.repositories.platform_repository import InMemoryPlatformRepository


DEFAULT_TIMEOUT_SECONDS = 600
MIN_TIMEOUT_SECONDS = 30
MAX_TIMEOUT_SECONDS = 3600


class ExecutionError(Exception):
    """A user-safe execution validation or startup error."""


class CodexExecutionService:
    def __init__(
        self,
        repository: InMemoryPlatformRepository,
        workspace_root: Path | None = None,
        timeout_seconds: int | None = None,
    ) -> None:
        self._repository = repository
        self._workspace_root = (workspace_root or Path(__file__).resolve().parents[3]).resolve()
        if timeout_seconds is not None:
            configured_timeout = timeout_seconds
        else:
            try:
                configured_timeout = int(os.getenv("CODEX_EXECUTION_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)))
            except ValueError:
                configured_timeout = DEFAULT_TIMEOUT_SECONDS
        self._timeout_seconds = max(MIN_TIMEOUT_SECONDS, min(configured_timeout, MAX_TIMEOUT_SECONDS))
        self._executions: dict[str, TaskExecutionResponse] = {}
        self._lock = RLock()
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="hacknova-codex")

    def get_execution(self, task_id: str) -> TaskExecutionResponse | None:
        with self._lock:
            return self._executions.get(task_id)

    def start_execution(self, task_id: str, confirmed: bool) -> TaskExecutionResponse:
        if not confirmed:
            raise ExecutionError("Explicit confirmation is required before execution starts.")
        task = self._repository.get_task(task_id)
        if task is None:
            raise ExecutionError("Task not found.")
        if task.assigned_agent_id != "code-engineer" or task.assigned_agent_name != "Code Engineer":
            raise ExecutionError("Only tasks assigned to Code Engineer can be executed.")
        with self._lock:
            current = self._executions.get(task_id)
            if current and current.status in {"pending", "running"}:
                raise ExecutionError("This task already has an execution in progress.")
            execution = TaskExecutionResponse(
                id=str(uuid4()),
                task_id=task_id,
                status="pending",
                stdout="",
                stderr="",
                jsonl_events=0,
                exit_code=None,
                final_response=None,
                started_at=None,
                completed_at=None,
                timeout_seconds=self._timeout_seconds,
            )
            self._executions[task_id] = execution
        self._executor.submit(self._run, task_id, task.title, task.description, execution.id)
        return execution

    def _run(self, task_id: str, title: str, description: str, execution_id: str) -> None:
        started_at = datetime.now(timezone.utc)
        self._update(task_id, execution_id, status="running", started_at=started_at)
        output_path: str | None = None
        try:
            executable = shutil.which("codex")
            if not executable:
                raise ExecutionError("Codex CLI was not found on the backend process PATH.")
            prompt = f"Implement this HackNova task:\n\nTitle: {title}\n\nDescription:\n{description or 'No additional description.'}"
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                prefix=".hacknova-codex-",
                suffix=".txt",
                dir=self._workspace_root,
                delete=False,
            ) as output_file:
                output_path = output_file.name
            command = [
                executable,
                "exec",
                "--cd",
                str(self._workspace_root),
                "--sandbox",
                "workspace-write",
                "--json",
                "--output-last-message",
                output_path,
                prompt,
            ]
            process = subprocess.Popen(
                command,
                cwd=self._workspace_root,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=False,
            )
            try:
                stdout, stderr = process.communicate(timeout=self._timeout_seconds)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                self._finish(
                    task_id,
                    execution_id,
                    status="failed",
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=None,
                    error=f"Codex execution timed out after {self._timeout_seconds} seconds.",
                    started_at=started_at,
                )
                return
            final_response = self._read_final_response(output_path)
            jsonl_events = self._count_jsonl_events(stdout)
            status = "completed" if process.returncode == 0 else "failed"
            self._finish(
                task_id,
                execution_id,
                status=status,
                stdout=stdout,
                stderr=stderr,
                exit_code=process.returncode,
                final_response=final_response,
                jsonl_events=jsonl_events,
                error=None if status == "completed" else "Codex exited with a non-zero status.",
                started_at=started_at,
            )
        except (OSError, ExecutionError, ValueError) as error:
            self._finish(
                task_id,
                execution_id,
                status="failed",
                stdout="",
                stderr="",
                jsonl_events=0,
                exit_code=None,
                error=str(error),
                started_at=started_at,
            )
        finally:
            if output_path:
                try:
                    Path(output_path).unlink(missing_ok=True)
                except OSError:
                    pass

    def _read_final_response(self, output_path: str) -> str | None:
        try:
            value = Path(output_path).read_text(encoding="utf-8").strip()
        except OSError:
            return None
        return self._redact(value) if value else None

    @staticmethod
    def _count_jsonl_events(stdout: str) -> int:
        count = 0
        for line in stdout.splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict):
                count += 1
        return count

    def _finish(self, task_id: str, execution_id: str, **values: object) -> None:
        values["completed_at"] = datetime.now(timezone.utc)
        values["stdout"] = self._redact(str(values.get("stdout", "")))
        values["stderr"] = self._redact(str(values.get("stderr", "")))
        self._update(task_id, execution_id, **values)

    def _update(self, task_id: str, execution_id: str, **values: object) -> None:
        with self._lock:
            current = self._executions.get(task_id)
            if current is None or current.id != execution_id:
                return
            self._executions[task_id] = current.model_copy(update=values)

    @staticmethod
    def _redact(value: str) -> str:
        redacted = re.sub(r"(?i)(bearer\s+)[^\s]+", r"\1[REDACTED]", value)
        redacted = re.sub(r"(?i)\b(sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9_]{12,})\b", "[REDACTED]", redacted)
        for key, secret in os.environ.items():
            if secret and len(secret) >= 12 and re.search(r"(?i)(token|secret|password|api[_-]?key|credential)", key):
                redacted = redacted.replace(secret, "[REDACTED]")
        try:
            for line in redacted.splitlines():
                if line.strip().startswith("{"):
                    json.loads(line)
        except json.JSONDecodeError:
            pass
        return redacted


codex_execution_service: CodexExecutionService | None = None


def get_codex_execution_service(repository: InMemoryPlatformRepository) -> CodexExecutionService:
    global codex_execution_service
    if codex_execution_service is None:
        codex_execution_service = CodexExecutionService(repository)
    return codex_execution_service
