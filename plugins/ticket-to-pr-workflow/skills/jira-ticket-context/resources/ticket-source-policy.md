# Ticket Source Policy

The Codex App-native parent workflow supports these user-facing intake sources:

- `jira`
- `manual`

## Jira Source

Jira tickets are read through the Jira MCP server registered in Codex
`config.toml`.

Apply `jira-space-policy.md` for scope resolution and `jira-mcp-policy.md` for
read-only and assignee rules. Do not choose a space on the user's behalf and do
not broaden the selected scope when Jira fails.

## Manual Source

Manual Ticket Intake is owned by `ticket-to-pr-workflow`. It is used when Jira
is unavailable or the user supplies a feature request directly. The parent
collects title, requirements, acceptance criteria, constraints, and intended
behavior, then supplies normalized ticket-like context.

Do not invent missing acceptance criteria. Stop for clarification when required
details are missing.
