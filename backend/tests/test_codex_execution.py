import unittest
import os
from pathlib import Path

from app.models.platform import TaskCreateRequest
from app.repositories.platform_repository import InMemoryPlatformRepository
from app.services.codex_execution import CodexExecutionService, ExecutionError


class CodexExecutionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = InMemoryPlatformRepository()
        self.service = CodexExecutionService(self.repository, workspace_root=Path.cwd(), timeout_seconds=30)
        self.service._executor.submit = lambda *args, **kwargs: None
        self.task = self.repository.create_task(TaskCreateRequest(title="Implement API", description="Add endpoint"))

    def test_requires_confirmation(self) -> None:
        with self.assertRaisesRegex(ExecutionError, "confirmation"):
            self.service.start_execution(self.task.id, confirmed=False)

    def test_requires_code_engineer_assignment(self) -> None:
        with self.assertRaisesRegex(ExecutionError, "Code Engineer"):
            self.service.start_execution(self.task.id, confirmed=True)

    def test_rejects_duplicate_active_execution(self) -> None:
        assigned = self.repository.assign_task(self.task.id, "code-engineer")
        self.assertIsNotNone(assigned)
        first = self.service.start_execution(self.task.id, confirmed=True)
        self.assertEqual(first.status, "pending")
        with self.assertRaisesRegex(ExecutionError, "already has"):
            self.service.start_execution(self.task.id, confirmed=True)

    def test_counts_only_valid_jsonl_objects(self) -> None:
        output = '{"type":"started"}\nnot-json\n{"type":"completed"}\n[]\n'
        self.assertEqual(self.service._count_jsonl_events(output), 2)

    def test_redacts_sensitive_values(self) -> None:
        secret_name = "HACKNOVA_TEST_TOKEN"
        original = os.environ.get(secret_name)
        os.environ[secret_name] = "test-secret-value-1234"
        try:
            redacted = self.service._redact("token=test-secret-value-1234")
        finally:
            if original is None:
                os.environ.pop(secret_name, None)
            else:
                os.environ[secret_name] = original
        self.assertNotIn("test-secret-value-1234", redacted)


if __name__ == "__main__":
    unittest.main()
