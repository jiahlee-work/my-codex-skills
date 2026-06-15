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
- Updated `Local Verification` section in `agent-run-report.md`

## Main Steps

1. Load the latest agent run with complete implementation artifacts or use the
   `--agent-run` path.
2. Stop and list missing required inputs.
3. Select light or full mode from implementation scope and risk.
4. Use `react-typescript-coding-style` as a failure-analysis lens when changed
   files include React, Next.js, TypeScript UI, TSX, JSX, hooks, or component
   files.
5. Resolve package scripts and TypeScript fallback commands.
6. Run commands sequentially, collect logs, and stop after failure by default.
7. Analyze failures before any allowed retry.
8. Generate reports, update the shared agent run report, and stop before
   commit.

Workflow:

`LOAD_AGENT_RUN`
→ `READ_TASK_SPEC`
→ `READ_TEST_ENVIRONMENT_REPORT`
→ `READ_TEST_PLAN`
→ `READ_CHANGED_FILES`
→ `DECIDE_VERIFICATION_MODE`
→ `LOAD_REACT_TYPESCRIPT_CODING_STYLE_IF_RELEVANT`
→ `RESOLVE_AVAILABLE_COMMANDS`
→ `RUN_VERIFICATION_COMMANDS`
→ `COLLECT_LOGS`
→ `ANALYZE_FAILURE_IF_ANY`
→ `RETRY_IF_ALLOWED`
→ `GENERATE_VERIFICATION_REPORT`
→ `GENERATE_FAILURE_REPORT_IF_FAILED`
→ `UPDATE_AGENT_RUN_REPORT_SECTION`
→ `STOP_BEFORE_COMMIT`

## Safety Rules

- Do not modify product code, tests, dependencies, package or lockfiles, or
  configuration.
- Do not fix coding style guide violations during verification; report them as
  actionable follow-up or failure analysis.
- Do not install dependencies.
- Do not commit, push, create a PR, inspect GitHub Actions, mutate Jira, or run
  Playwright MCP.
- Detect Playwright or E2E commands only; do not execute them during local verification.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Supporting style skill: `react-typescript-coding-style`
- Resolve: `scripts/resolve-verification-commands.ts`
- Run: `scripts/run-verification.ts`
- Analyze: `scripts/analyze-verification-failure.ts`
- Reports: `scripts/generate-verification-report.ts`,
  `scripts/generate-failure-report.ts`
