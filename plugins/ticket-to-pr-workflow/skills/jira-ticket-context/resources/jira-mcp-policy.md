# Jira MCP Policy

Jira intake requires a Jira MCP server registered in Codex `config.toml`. This
repository does not prescribe a server package, installation command,
environment variable scheme, authentication mechanism, or personal
configuration example.

Jira access is read-only.

The Codex agent calls the MCP tools provided by its runtime. Local TypeScript
scripts only normalize, validate, classify, and render agent-provided results.
They must not parse `config.toml`, start an MCP server process, implement an MCP
client, or manage MCP authentication.

Allowed MCP actions:

- Get the current Jira user.
- Read accessible Jira resources and visible spaces.
- Search assigned issues inside the user-selected space.
- Read issue detail by key.

If assigned-ticket search is unavailable, stop with a clear MCP capability
error. Do not broaden the query, choose a different space, or fall back to a
different data source.

Forbidden actions:

- Jira ticket update.
- Jira comment creation.
- Status transition.
- Assignee change.
- Sprint change.
- Field update.
- Secret or token output.

## Assignee Check

Compare the ticket assignee with the current Jira user using the stable account
identifier exposed by the MCP when available. Human-readable account metadata
is fallback context only.

## Persistence

Do not persist full Jira descriptions or comments in `.agent-runs` by default.
Persist summaries, parsed Acceptance Criteria, necessary metadata, and
classification reasons only.
