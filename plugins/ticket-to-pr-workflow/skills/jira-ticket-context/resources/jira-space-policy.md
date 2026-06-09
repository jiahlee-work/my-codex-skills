# Jira Space Policy

Use `space` in user-facing documentation. Jira APIs and JQL may expose the same
object as a project.

1. Call Jira MCP `getVisibleJiraProjects`.
2. For each space, count current-user non-Done tickets with scoped JQL.
3. Present each space as `{number}. {space name}({key}): {count} tickets`.
4. Ask the user to enter the list number, exact space name, or key.
5. Validate the selected key against the MCP result.
6. Build the assigned-ticket JQL only for the selected space.

The Codex App parent skill owns the user-facing selection flow and performs the
Jira MCP calls. `ticket-source.ts` may format or normalize the returned data,
but it does not connect to Jira or MCP itself.

Default JQL:

```text
project = "{selectedSpaceKey}" AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC
```

Do not infer a space from environment configuration. Do not query all Jira
tickets when no space is selected.

Follow `nextPageToken` when counting so the displayed value is not limited to
the first 100 tickets. If Jira Search is unavailable, keep the space list and
mark the count unavailable.
