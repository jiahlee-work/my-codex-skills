---
name: ticket-code-worker
description: Prepare or confirm a validated working branch, then implement ticket-scoped product and test code, collect the working-tree diff, detect risky changes, and generate implementation and code review reports. Use after ticket intent, task, test, and branch planning artifacts are ready and the parent has reached the Branch Preparation gate.
---

# Ticket Code Worker

## When To Use

Use for Implementation after the selected agent run contains complete ticket context,
task planning, branch planning, test environment, and test plan artifacts.

## Inputs

- Required: `ticket-context-report.md`, `requirement-summary.md`, `task-spec.md`,
  `plan-critic-report.md`, `branch-commit-plan.md`,
  `test-environment-report.md`, and `test-plan.md`
- Optional: `user-implementation-intent.md`, `test-setup-proposal.md`
- Current conversation intent when the intent file is absent

## Outputs

- `implementation-summary.md`
- `code-review-report.md`
- `diff-summary.md`
- `changed-files.json`
- `risk-detection-report.md` when risk detection runs
- Optional `test-change-summary.md`
- Updated `Ticket Code Work` section in `agent-run-report.md`

## Main Steps

1. Load one agent run with complete planning and test-planning artifacts.
2. Save the current conversation intent if the intent artifact is absent.
3. Check Git status and validate the planned branch.
4. Stop for parent-managed approval when branch creation or switching is
   required, then confirm the working branch.
5. Analyze related code, nearby tests, conventions, state, imports, and mocks.
6. Implement only the user intent, Task Spec, and Test Plan scope.
7. Add or update focused tests using the existing test stack.
8. Collect the diff and changed-file metadata.
9. Detect risky, unrelated, sensitive, large, or unapproved config changes.
10. Generate implementation and code review reports.
11. Stop before full local verification.

Workflow:

`LOAD_AGENT_RUN`
→ `READ_TICKET_CONTEXT`
→ `READ_USER_IMPLEMENTATION_INTENT`
→ `READ_TASK_SPEC`
→ `READ_TEST_ENVIRONMENT_REPORT`
→ `READ_TEST_PLAN`
→ `READ_BRANCH_COMMIT_PLAN`
→ `CHECK_GIT_STATUS`
→ `CHECK_SAFE_BASE_BRANCH`
→ `RESOLVE_BRANCH_PREPARATION_GATE`
→ `CONFIRM_WORKING_BRANCH`
→ `ANALYZE_CODEBASE`
→ `IMPLEMENT_CODE_AND_TESTS`
→ `COLLECT_DIFF`
→ `DETECT_RISKY_CHANGES`
→ `GENERATE_IMPLEMENTATION_SUMMARY`
→ `GENERATE_CODE_REVIEW_REPORT`
→ `STOP_BEFORE_VERIFICATION`

## Safety Rules

- Treat the user's implementation intent as the primary scope input. Record and
  stop on conflicts with the ticket or Task Spec.
- Do not continue without `test-plan.md`; run `test-plan-worker` first.
- Do not modify code on `main`, `master`, or `develop`.
- Do not modify product or test files until Branch Preparation is confirmed.
- Do not continue with pre-existing changes without explicit user approval.
- Do not overwrite an existing planned branch.
- Do not install test libraries or change package, lock, environment, build, or
  test setup files without test-planning approval.
- Do not run full lint, typecheck, test, build, Playwright, or retry workflows.
- Do not commit, push, create a PR, mutate Jira, or run Playwright MCP.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Git check: `scripts/check-git-status.ts`
- Branch creation: `scripts/create-working-branch.ts`
- Diff collection: `scripts/collect-diff.ts`
- Risk detection: `scripts/detect-risky-changes.ts`
- Reports: `scripts/generate-implementation-summary.ts`,
  `scripts/generate-code-review-report.ts`
