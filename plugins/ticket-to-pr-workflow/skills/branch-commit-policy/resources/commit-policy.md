# Commit Policy

Commit messages follow Conventional Commits without scope.

Format:

```text
{type}: {summary}
Refs: {ticketKey}
```

Example:

```text
feat: show login failure message
Refs: FE-123
```

Allowed types:

- `feat`
- `fix`
- `test`
- `refactor`
- `chore`
- `docs`

Validation rules:

- First line must match `{type}: {summary}`.
- Scope syntax such as `feat(auth): ...` is not allowed.
- Type must be one of the allowed types.
- Message must include `Refs: {ticketKey}` on its own line.

The CLI validator also accepts an inline `Refs: {ticketKey}` trailer for shell
compatibility, but generated plans use the canonical two-line form.
