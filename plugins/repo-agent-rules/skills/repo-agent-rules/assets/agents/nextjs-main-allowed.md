# Agent Instructions

## Source Of Truth

- Follow this file and `docs/engineering/*` for common agent rules.
- These rules are fixed common rules, not a summary of the current repository.
- Do not create repository-specific docs from source inspection unless the user
  explicitly names the exact file path and asks for that content.
- Preserve user changes. Do not revert files you did not change unless the user
  explicitly asks.

## Architecture

- Follow `docs/engineering/architecture.md`.
- Keep Next.js App Router files in root `app/`.
- Keep non-route product layers under `src/`.
- Keep route files thin and delegate product behavior to lower layers.

## Coding Style

- Follow `docs/engineering/coding-style.md`.
- Prefer small, named functions and explicit data flow.
- Avoid broad refactors while making scoped changes.

## Testing

- Follow `docs/engineering/testing.md`.
- Add or update tests when behavior changes or a bug is fixed.
- Do not introduce a new test tool unless the user explicitly asks.

## Verification

- Follow `docs/engineering/verification.md`.
- Run the narrowest relevant checks first, then broader checks when risk or
  change scope justifies them.
- Report any checks that could not be run.

## Git Workflow

- Follow `docs/engineering/git-workflow.md`.
- Direct pushes to `main` are allowed only when the user explicitly asks for
  that delivery path.
- Use Conventional Commits with optional scope:
  `<type>[optional scope]: <description>`.
- English and Korean commit descriptions are both allowed.
