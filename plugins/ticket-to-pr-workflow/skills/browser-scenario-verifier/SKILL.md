---
name: browser-scenario-verifier
description: Decide whether browser verification is needed, create a browser scenario plan, document Playwright MCP agent-mode results or skip reasons, and update Browser Verification status for ticket-to-PR workflows.
---

# Browser Scenario Verifier

## When To Use

Use only when implementation changed a browser-visible UI flow, route, form,
interaction, auth/permission view, checkout/order/signup flow, modal, toast, or
error message, or when Storybook verification was skipped or incomplete.

## Inputs

Required from `.agent-runs/{ticketKey}-{timestamp}/`:

- `task-spec.md`
- `test-plan.md`
- `changed-files.json`
- `implementation-summary.md`
- `verification-report.md`

Optional:

- `ticket-context-report.md`
- `user-implementation-intent.md`
- `storybook-report.md`
- `pr-plan.md`

## Outputs

- `browser-scenario-plan.md`
- `browser-verification-report.md`
- Updated `pr-plan.md` when present and `Browser Scenario Verification`
  section in `agent-run-report.md`

## Main Steps

`LOAD_AGENT_RUN`
→ `READ_TASK_SPEC`
→ `READ_TEST_PLAN`
→ `READ_CHANGED_FILES`
→ `READ_IMPLEMENTATION_SUMMARY`
→ `READ_VERIFICATION_REPORT`
→ `READ_STORYBOOK_REPORT_IF_EXISTS`
→ `DECIDE_BROWSER_VERIFICATION_NEEDED`
→ `CREATE_BROWSER_SCENARIO_PLAN_IF_NEEDED`
→ `RECORD_BROWSER_VERIFICATION_RESULT_OR_SKIPPED_REASON`
→ `UPDATE_PR_PLAN_WITH_BROWSER_STATUS`
→ `UPDATE_AGENT_RUN_REPORT_SECTION`
→ `STOP_BEFORE_FINAL_PR_EXECUTION`

## Safety Rules

- Local TypeScript scripts do not call Playwright MCP.
- Do not implement a local MCP client, MCP result merge script, Playwright
  installation automation, or project Playwright fallback runner.
- If Codex runtime exposes Playwright MCP, the agent reads
  `browser-scenario-plan.md` and performs the scenario directly.
- If MCP is unavailable, write `skipped` or `approval-required` in
  `browser-verification-report.md`.
- Use only localhost, 127.0.0.1, local preview, or explicitly approved staging.
- Never access production, perform real payment/email/destructive data actions,
  change accounts/permissions, read secrets, commit, push, or create a PR.

## Related Resources And Scripts

- `resources/browser-scenario-policy.md`
- `resources/playwright-mcp-policy.md`
- `resources/browser-verification-report-template.md`
- `scripts/generate-browser-scenario-plan.ts`
- `scripts/generate-browser-verification-report.ts`
