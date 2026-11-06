# Repository Guidelines

## Project Structure & Module Organization

This repository is currently empty. As you add the project, keep application code in a clearly named source directory (such as `src/`), tests in `tests/` or beside the code they cover, and static resources in `assets/` or `public/`. Group files by feature or responsibility, and add a short README when introducing major directories.

## Build, Test, and Development Commands

No build system or development commands are configured yet. When adding one, document the canonical setup, local run, test, and build commands in the README and keep them reproducible from the repository root. For example, a Node project might provide `npm install`, `npm run dev`, and `npm test`; use the commands defined by the chosen toolchain rather than assuming these examples apply.

## Coding Style & Naming Conventions

Follow the conventions of the language and framework selected for the project. Use consistent indentation, descriptive names, and focused modules. Prefer `PascalCase` for types, `camelCase` for functions and variables, and `kebab-case` for filenames unless the ecosystem has established alternatives. Add formatter and linter configuration with the first application code, and run them before submitting changes.

## Testing Guidelines

There is no test framework or coverage target configured yet. Add tests with each behavior change, use names that describe the expected outcome (for example, `handles-invalid-input`), and document how to run the suite. Keep tests deterministic and avoid relying on external services unless a test explicitly covers that integration.

## Commit & Pull Request Guidelines

Git history is not available in this directory, so no existing commit convention can be inferred. Use concise imperative commit subjects, such as `Add input validation`. Pull requests should explain the change and its motivation, list relevant verification steps, link related issues when applicable, and include screenshots for user-visible changes.

## Security & Configuration

Do not commit credentials, tokens, or local environment files. Provide a sanitized example configuration (such as `.env.example`) when configuration is introduced, and validate required settings at startup.
