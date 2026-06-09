---
name: verification-runner
description: Run local lint, typecheck, test, and build verification against completed implementation changes, collect logs, analyze failures and retries, and generate verification reports. Use when changed-files.json, diff-summary.md, implementation-summary.md, code-review-report.md, task-spec.md, test-environment-report.md, and test-plan.md are ready.
---

# Verification Runner

## When To Use

Use after product and test changes and their implementation reports are
complete.

## Inputs

- Required: `task-spec.md`, `test-environment-report.md`, `test-plan.md`,
  `changed-files.json`, `diff-summary.md`, `implementation-summary.md`, and
  `code-review-report.md`
- Optional: `user-implementation-intent.md`, `risk-detection-report.md`

## Outputs

- `verification-report.md`
- `failure-report.md` when verification fails
- `logs/{lint,typecheck,test,build}.log` for commands that run
- `logs/verification-summary.json`
- Updated `agent-run-report.md`

## Main Steps

1. Load the latest agent run with complete implementation artifacts or use the
   `--agent-run` path.
2. Stop and list missing required inputs.
3. Select light or full mode from implementation scope and risk.
4. Resolve package scripts and TypeScript fallback commands.
5. Run commands sequentially, collect logs, and stop after failure by default.
6. Analyze failures before any allowed retry.
7. Generate reports, update the agent run, and stop before commit.

Workflow:

`LOAD_AGENT_RUN`
→ `READ_TASK_SPEC`
→ `READ_TEST_ENVIRONMENT_REPORT`
→ `READ_TEST_PLAN`
→ `READ_CHANGED_FILES`
→ `DECIDE_VERIFICATION_MODE`
→ `RESOLVE_AVAILABLE_COMMANDS`
→ `RUN_VERIFICATION_COMMANDS`
→ `COLLECT_LOGS`
→ `ANALYZE_FAILURE_IF_ANY`
→ `RETRY_IF_ALLOWED`
→ `GENERATE_VERIFICATION_REPORT`
→ `GENERATE_FAILURE_REPORT_IF_FAILED`
→ `UPDATE_AGENT_RUN_REPORT`
→ `STOP_BEFORE_COMMIT`

## Safety Rules

- Do not modify product code, tests, dependencies, package or lockfiles, or
  configuration.
- Do not install dependencies.
- Do not commit, push, create a PR, inspect GitHub Actions, mutate Jira, or run
  Playwright MCP.
- Detect Playwright or E2E commands only; do not execute them during local verification.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Resolve: `scripts/resolve-verification-commands.ts`
- Run: `scripts/run-verification.ts`
- Analyze: `scripts/analyze-verification-failure.ts`
- Reports: `scripts/generate-verification-report.ts`,
  `scripts/generate-failure-report.ts`
