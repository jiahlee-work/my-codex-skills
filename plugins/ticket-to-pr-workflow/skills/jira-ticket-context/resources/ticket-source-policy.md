# Ticket Source Policy

The Codex App-native parent workflow supports these user-facing intake sources:

- `jira`
- `manual`

## Jira Source

Jira tickets are read through the Jira MCP server registered in Codex
`config.toml`.

Jira source supports two user-facing triggers:

- Assigned ticket selection: apply `jira-space-policy.md` for scope resolution,
  then read only assigned tickets in the selected space.
- Direct ticket key: when the parent detects a standalone key such as
  `ABC-123`, read issue detail by exact key and normalize that single ticket.

Apply `jira-mcp-policy.md` for read-only and assignee rules. Do not choose a
space on the user's behalf for assigned-ticket selection. Do not broaden the
selected scope, query all spaces, or substitute unrelated ticket data when Jira
fails.

## Manual Source

Manual Ticket Intake is owned by `ticket-to-pr-workflow`. It is used when Jira
is unavailable or the user supplies a feature request directly. The parent
collects title, requirements, acceptance criteria, constraints, and intended
behavior, then supplies normalized ticket-like context.

Do not invent missing acceptance criteria. Stop for clarification when required
details are missing.
