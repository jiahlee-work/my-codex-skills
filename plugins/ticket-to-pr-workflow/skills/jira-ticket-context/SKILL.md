---
name: jira-ticket-context
description: Read scoped read-only Jira tickets, normalize Jira or parent-provided manual ticket-like context, validate current-user assignment for Jira, classify readiness, and recommend approval and verification modes. Use for Jira intake, Jira space selection, ticket context retrieval, assignee checks, or readiness classification.
---

# Jira Ticket Context

## When To Use

Use before planning artifacts are generated.

## Inputs

- Jira MCP source or parent-provided manual ticket-like context
- Optional ticket key
- A space selected by the user from Jira MCP results

## Outputs

- `NormalizedTicket` collections
- `ticket-context-report.md`
- Readiness classification
- Recommended approval and verification modes

## Main Steps

1. Use the Jira MCP tools exposed to the Codex agent runtime. Local scripts
   must not read `config.toml`, start an MCP server, or create an MCP client.
2. For Jira intake, read visible spaces with Jira MCP.
3. Count current-user non-Done tickets for each space.
4. Show each space as `{number}. {space name}({key}): {count} tickets`.
5. Ask the user to enter the list number, exact space name, or key.
6. Build a scoped assigned-ticket JQL from the selected space.
7. Read tickets without Jira mutations.
8. Pass the MCP response and selected scope to the deterministic normalization
   helpers in `scripts/ticket-source.ts`.
9. Validate Jira assignee against the current user.
10. Classify readiness and recommend modes.
11. Render the selected Jira or manual ticket-like context using the report
    template.

Never infer a space from environment variables or query all spaces. Present the
`getVisibleJiraProjects` result and wait for the user's selection before reading
tickets. Generate the scoped query from that selection.

Manual Ticket Intake is owned by `ticket-to-pr-workflow`. This child skill may
normalize that parent-provided context, but it must not invent acceptance
criteria.

## Related Resources And Scripts

- `resources/ticket-source-policy.md`
- `resources/jira-mcp-policy.md`
- `resources/jira-space-policy.md`
- `resources/readiness-policy.md`
- `resources/normalized-ticket.md`
- `resources/ticket-context-report-template.md`
- `scripts/ticket-source.ts`
- `scripts/classify-tickets.ts`
- `scripts/ticket-context-report.ts`
