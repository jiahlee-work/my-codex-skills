---
name: pr-reporting
description: Generate and validate dry-run commit and PR plans after local, Storybook, and Browser Verification gates are resolved, then execute commits, push, and GitHub PR creation only after explicit final approval.
---

# PR Reporting

## When To Use

Use after local verification is `passed`, Storybook and Browser Verification
statuses are resolved, and `changed-files.json`, `diff-summary.md`, and
`branch-commit-plan.md` are ready.

## Inputs

- Required: `branch-commit-plan.md`, `changed-files.json`, `diff-summary.md`,
  `implementation-summary.md`, `code-review-report.md`,
  `verification-report.md`, `storybook-report.md`,
  `browser-verification-report.md`
- Optional: ticket, requirement, task spec, critic, intent, risk, and failure
  reports from the same agent run

## Outputs

- `commit-plan.md`
- `pr-description.md`
- `pr-plan.md`
- Final `agent-run-report.md`

## Main Steps

`LOAD_AGENT_RUN`
-> `CHECK_VERIFICATION_PASSED`
-> `CHECK_STORYBOOK_AND_BROWSER_GATES`
-> `CHECK_GIT_STATE`
-> `GENERATE_AND_VALIDATE_COMMIT_MESSAGES`
-> `GENERATE_PR_DESCRIPTION`
-> `CREATE_PR_PLAN`
-> `STOP_FOR_FINAL_APPROVAL`
-> `EXECUTE_IF_APPROVED`
-> `FINALIZE_AGENT_RUN_REPORT`

## Safety Rules

- Dry-run is the default.
- Generate dry-run artifacts after Storybook and Browser statuses are resolved.
- Run commits, push, and `gh pr create` only with `--execute`.
- Stop on failed or approval-required delivery checks. Require
  `--approve-storybook-skip` or `--approve-browser-skip` for recorded skips.
- Never force push or use `main`, `master`, or `develop` as the head branch.
- Stop for failed verification, missing artifacts, missing origin, secret paths,
  unapproved package or lockfile changes, or commit policy failures.
- Do not modify code, tests, dependencies, package files, or lockfiles.
- Do not wait for GitHub Actions.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Prerequisites: `scripts/check-prerequisites.ts`
- Commit plan: `scripts/generate-commit-plan.ts`,
  `scripts/validate-commit-plan.ts`
- PR artifacts: `scripts/generate-pr-description.ts`,
  `scripts/create-pr-plan.ts`
- Execution and final report: `scripts/execute-commit-and-pr.ts`,
  `scripts/finalize-agent-run-report.ts`
