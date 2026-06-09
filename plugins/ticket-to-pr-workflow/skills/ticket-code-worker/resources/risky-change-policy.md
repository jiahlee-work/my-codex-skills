# Risky Change Policy

Detect and report at least:

- More than 20 changed files
- More than 500 added and deleted lines
- More than 10 test files or 300 test diff lines
- Any `package.json` change
- Lockfile changes
- Environment file changes
- Build, TypeScript, test runner, or test setup config changes
- Product or test changes on `main`, `master`, or `develop`
- Files that appear unrelated to the Task Spec, Test Plan, or user intent
- Authentication, authorization, payment, security, or data deletion logic

Package, lock, environment, build, and test setup changes require evidence of
test-planning approval. Without approval, stop and mark the review `blocked`.

Large or clearly unrelated changes require a narrower diff before local verification.
Sensitive changes may proceed only when they are in scope, but must be called
out for strict review and full verification.
