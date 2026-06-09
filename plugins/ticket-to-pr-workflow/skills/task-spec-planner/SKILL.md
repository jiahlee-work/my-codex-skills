---
name: task-spec-planner
description: Generate Requirement Summary, Agent Task Spec, Plan Critic Report, ambiguity, dependency, risk, and an initial test-plan draft from a normalized and classified ticket. Use after ticket triage and before test environment analysis.
---

# Task Spec Planner

## When To Use

Use after `jira-ticket-context` selects and classifies a ticket.

## Inputs

- Agent-provided normalized `TicketCollection`
- Readiness classification and recommended modes

## Outputs

- `requirement-summary.md`
- `task-spec.md`
- `plan-critic-report.md`
- Complete planning report set through the generator script

## Main Steps

1. Summarize requirements and Acceptance Criteria.
2. Separate ambiguity, dependency, and risk.
3. Draft implementation scope and tests.
4. Critique coverage and approval gates.
5. Ask `branch-commit-policy` to render the branch and commit plan.

The generator reads a normalized ticket collection with `--input`. It does not
query Jira or call MCP.

## Related Resources And Scripts

- `resources/requirement-summary-template.md`
- `resources/task-spec-template.md`
- `resources/plan-critic-template.md`
- `scripts/generate-planning-artifacts.ts`
