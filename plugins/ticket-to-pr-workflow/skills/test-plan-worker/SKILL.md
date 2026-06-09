---
name: test-plan-worker
description: Detect the repository test environment, analyze test conventions, propose missing setup, and generate a test plan. Use after Jira or manual ticket context is selected, the user has described implementation intent, and ticket-context-report.md, requirement-summary.md, task-spec.md, plan-critic-report.md, and branch-commit-plan.md exist in one agent run.
---

# Test Plan Worker

## When To Use

Use before implementation when the selected ticket has complete planning
artifacts under `.agent-runs/{ticketKey}-{timestamp}/`.

## Inputs

- Required: `ticket-context-report.md`, `requirement-summary.md`, `task-spec.md`,
  `plan-critic-report.md`, and `branch-commit-plan.md`
- Optional: `user-implementation-intent.md`
- Current conversation implementation intent when the optional file is absent

## Outputs

- `test-environment-report.md`
- `test-plan.md` when setup exists or the user approves a proposed stack
- `test-setup-proposal.md` when setup is missing or insufficient
- Updated `agent-run-report.md`

## Main Steps

1. Load the latest complete agent run for the selected ticket.
2. Save a concise conversation intent summary when the intent file is absent.
3. Detect libraries, commands, configs, environments, and test file conventions.
4. Write the environment report.
5. Write a setup proposal and stop for approval when setup is insufficient.
6. Generate the test plan after setup is available or explicitly approved.
7. Update the agent run report and stop before code changes.

## Safety Rules

- Do not implement product code or test code in Test Planning.
- Do not run full lint, typecheck, build, test, or Playwright verification.
- Do not install dependencies or change package, lock, config, setup, or test
  files without explicit approval.
- Do not create branches, commits, pushes, PRs, deployments, or Jira mutations.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Detect: `scripts/detect-test-environment.ts`
- Analyze conventions: `scripts/analyze-test-conventions.ts`
- Propose setup: `scripts/generate-test-setup-proposal.ts`
- Generate plan: `scripts/generate-test-plan.ts`
