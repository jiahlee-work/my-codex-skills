# Commit Policy

Commit messages follow Conventional Commits without scope.

Format:

```text
{type}: {summary}
Refs: {ticketKey}
```

Example:

```text
feat: 로그인 실패 메시지 표시
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
- Type must be lowercase, such as `feat:`. `Feat:` is invalid.
- Scope syntax such as `feat(auth): ...` is not allowed.
- Type must be one of the allowed types.
- Summary must be written in Korean and include Hangul.
- Message must include `Refs: {ticketKey}` on its own line.

The CLI validator also accepts an inline `Refs: {ticketKey}` trailer for shell
compatibility, but generated plans use the canonical two-line form.
