# Artifact Policy

Use one run directory for the complete selected-ticket workflow:

```text
.agent-runs/{ticketKey}-{timestamp}/
```

## Artifact Groups

### Ticket Context

- `assigned-ticket-list.json`
- `ticket-context-report.md`

Persist summary-level Jira metadata and parsed acceptance criteria only. Do not
persist full Jira descriptions, comments, secrets, or tokens by default.

### Planning

- `requirement-summary.md`
- `task-spec.md`
- `plan-critic-report.md`
- `user-implementation-intent.md`
- `branch-commit-plan.md`

### Test Planning

- `test-environment-report.md`
- `test-setup-proposal.md` when setup is missing or insufficient
- `test-plan.md` when setup exists or an option is approved

### Implementation

- `implementation-summary.md`
- `code-review-report.md`
- `diff-summary.md`
- `changed-files.json`
- `risk-detection-report.md`

### Verification

- `verification-report.md`
- `failure-report.md` when verification fails
- `storybook-environment-report.md`
- `storybook-setup-proposal.md` when Storybook setup is missing
- `storybook-plan.md`
- `stories-changed.json` when approved story files change
- `storybook-report.md`
- `browser-scenario-plan.md`
- `browser-verification-report.md`

### Delivery

- `commit-plan.md`
- `pr-description.md`
- `pr-plan.md`
- `agent-run-report.md`

## Cumulative Reporting

Each child skill reuses the selected run directory and appends its result to
`agent-run-report.md`. Record generated artifacts, approvals, skipped gates,
verification status, remaining risks, execution status, and the PR URL when a
PR is created.

Final PR reporting must include local, Storybook, and Browser Verification
statuses and links to the relevant artifacts.

Keep `ticket-context-report.md` in the section order defined by
`skills/jira-ticket-context/resources/ticket-context-report-template.md`.
