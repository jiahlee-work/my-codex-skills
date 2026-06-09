# Retry Policy

- Analyze the failed log before every retry.
- Allow at most three total attempts for one command.
- Retry only transient test, timeout, cache, worker, snapshot, or clearly small
  TypeScript failure signals.
- Stop after three consecutive failures of the command.
- Do not retry requirement ambiguity, dependency or package changes, missing
  configuration, external service or network failure, required secrets,
  environment variables, or large refactoring needs.
- Local Verification does not edit code or tests to make a retry pass.
