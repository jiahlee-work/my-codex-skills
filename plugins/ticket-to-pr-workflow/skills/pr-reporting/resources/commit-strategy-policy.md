# Commit Strategy Policy

Read the strategy from `branch-commit-plan.md`, or use `--strategy`. Default to
`logical`.

- `logical`: separate tests, implementation, documentation, and tooling when
  those groups exist.
- `squash`: create one commit containing every changed file.
- `step-based`: commit tests, implementation, then supporting files.

Every changed file must appear exactly once. Messages use no scope, lowercase
type, and Korean summary:

```text
{type}: {summary}
Refs: {ticketKey}
```

Allowed types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`.
