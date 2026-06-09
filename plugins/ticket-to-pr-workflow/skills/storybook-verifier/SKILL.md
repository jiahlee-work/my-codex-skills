---
name: storybook-verifier
description: Detect Storybook setup, analyze existing stories and changed UI components, plan approval-gated story work, run available Storybook checks, and write Storybook verification reports. Use after UI-related implementation changes when changed-files.json, diff-summary.md, implementation-summary.md, code-review-report.md, and verification-report.md are ready.
---

# Storybook Verifier

## When To Use

Use after component or UI code changes when the required diff, implementation,
review, and verification artifacts are ready in one agent run.

## Inputs

- Required: `changed-files.json`, `diff-summary.md`,
  `implementation-summary.md`, `code-review-report.md`, and
  `verification-report.md`
- Optional: ticket, task, test, intent, commit, PR, and agent run reports from
  the same `.agent-runs/{ticketKey}-{timestamp}/` directory

## Outputs

- `storybook-environment-report.md`
- `storybook-plan.md` when Storybook is configured
- `storybook-setup-proposal.md` when setup is missing
- `stories-changed.json` when approved story files are written
- `storybook-report.md`
- Updated `pr-plan.md` and `agent-run-report.md`

## Main Steps

`LOAD_AGENT_RUN`
→ `READ_CHANGED_FILES`
→ `DETECT_STORYBOOK_ENVIRONMENT`
→ `CREATE_SETUP_PROPOSAL_IF_MISSING`
→ `ANALYZE_EXISTING_STORIES`
→ `IDENTIFY_COMPONENT_CHANGES`
→ `CREATE_STORYBOOK_PLAN`
→ `WRITE_STORIES_IF_APPROVED`
→ `RUN_AVAILABLE_CHECKS`
→ `GENERATE_STORYBOOK_REPORT`
→ `UPDATE_DELIVERY_REPORTS`
→ `STOP_BEFORE_FINAL_PR_EXECUTION`

## Safety Rules

- Treat setup and story writing as approval-gated repository changes.
- Use `--execute-setup` only after setup approval and `--write-stories` only
  after story-write approval.
- Without `--write-stories`, generate plans and reports only.
- With `--skip-install`, do not install or configure Storybook.
- Stop before commit, push, PR creation, GitHub Actions, production access, or
  browser scenario execution.
- Stop for a new dependency requirement and request approval.

## Related Resources And Scripts

- Policies and templates: `resources/*.md`
- Detect and analyze: `scripts/detect-storybook-environment.ts`,
  `scripts/analyze-existing-stories.ts`
- Setup and planning: `scripts/generate-storybook-setup-proposal.ts`,
  `scripts/generate-storybook-plan.ts`
- Checks and report: `scripts/run-storybook-checks.ts`,
  `scripts/generate-storybook-report.ts`
