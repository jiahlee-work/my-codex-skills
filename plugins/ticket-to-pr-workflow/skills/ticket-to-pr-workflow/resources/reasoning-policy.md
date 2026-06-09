# Reasoning Policy

- Use Codex reasoning effort `high` by default.
- Use `very high` or `xhigh` only when the current execution environment
  explicitly supports that value.
- Fall back to `high` when support is unknown or unavailable.
- Higher reasoning effort never removes approval or safety requirements.
