# Implementation Policy

## Scope Priority

Use these inputs together, with the user's implementation intent taking
priority:

1. `user-implementation-intent.md` or the current conversation summary
2. `task-spec.md`
3. `test-plan.md`
4. `ticket-context-report.md`
5. `requirement-summary.md`
6. `plan-critic-report.md`
7. `test-environment-report.md`
8. `branch-commit-plan.md`
9. Current codebase conventions

If user intent conflicts with the ticket, Task Spec, or safety constraints, do
not guess. Record the mismatch in `code-review-report.md`, set the decision to
`blocked`, and request confirmation.

## Allowed Changes

- Minimal feature or bug-fix code required by the Task Spec
- Focused tests required by `test-plan.md`
- Small behavior-preserving refactors needed for the implementation

Do not perform unrelated refactors, broad file moves, dependency installation,
or architecture changes.

## Test Changes

- Follow the existing test file location, naming, runner, environment, and mock
  conventions from `test-environment-report.md` and nearby tests.
- Cover the Test Plan's observable behavior, regression cases, and error paths.
- Do not add a new test library during implementation.
- If the approved test stack is not installed or configured, stop and return to
  Test Planning setup approval.

## Phase Boundary

Focused checks for directly changed tests are optional. Full lint, typecheck,
test, build, browser verification, retries, commit, push, and PR creation belong
to later phases.
