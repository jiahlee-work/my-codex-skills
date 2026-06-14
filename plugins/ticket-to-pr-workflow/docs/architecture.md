# Architecture

## Codex App-native Orchestration

`ticket-to-pr-workflow` is the parent orchestrator. The primary interface is a
Codex App conversation, not a sequence of package scripts. The parent reads the
conversation, `.agent-runs/.active-run.json`, and the active run artifacts to
choose the next child skill and stop at the correct approval gate.

Child skills own specific workflow areas:

- Jira ticket intake and ticket context normalization
- task planning and implementation-intent capture
- test planning
- branch and commit policy
- ticket-scoped code work and diff capture
- local verification
- Storybook verification
- Browser Scenario Verification
- PR dry-run artifacts and final execution gates

## MCP Prerequisites

Full Jira intake and browser verification require the corresponding MCP servers
to be registered in Codex `config.toml`.

- Jira MCP provides assigned-ticket and ticket-detail reads.
- Playwright MCP provides browser actions against localhost or an explicitly
  approved staging target.

MCP calls are made by the Codex agent runtime. Local TypeScript helpers do not
parse `config.toml`, start MCP processes, implement MCP clients, or manage MCP
authentication.

Installation commands, package names, environment variable names,
authentication details, and personal configuration examples are intentionally
outside this repository's documentation.

## Ticket Intake

The parent prefers read-only Jira MCP intake when Jira is configured. Jira MCP
intake has two triggers:

- Assigned ticket selection: list visible spaces, wait for the user to choose a
  scope, and read only tickets assigned to the current user in that scope.
- Direct ticket key: detect a standalone Jira key such as `ABC-123`, read that
  issue detail by exact key, and validate it is assigned to the current user.

If Jira is unavailable or the user supplies a feature request directly, the
parent can normalize the conversation into manual ticket context. Missing
acceptance criteria must be clarified rather than invented.

## Active Run State

`.agent-runs/.active-run.json` stores resumable Codex App runtime state such as
the last displayed Jira ticket list, selected ticket, manual context,
`nextAction`, `blockedBy`, approvals, and skips. Its intake source is `jira` or
`manual`.

The active state and real run directories are ignored because they may contain
ticket context, local paths, and temporary execution data.

## Artifact Flow

Each selected ticket run writes cumulative artifacts under
`.agent-runs/{ticketKey}-{timestamp}/`. Later stages read earlier outputs and
append reports, so the parent can resume safely from the latest complete
boundary.

Planning creates ticket context, requirement, task spec, critic, user intent,
test, and branch/commit artifacts. Branch Preparation then confirms a validated
working branch before any product or test file is changed.

## Delivery Order

The delivery order is:

1. Jira or manual intake and context analysis
2. user implementation intent and task planning
3. test planning
4. Branch Preparation
5. ticket-scoped product and test code work
6. local verification
7. Storybook verification
8. Browser Scenario Verification
9. PR dry-run artifacts
10. explicit commit, push, and PR approval gate
11. final reporting

PR dry-run artifacts are generated after Storybook and Browser gates so their
status is represented in the commit and PR plan. Actual commit, push, and PR
creation remain separately approval-gated.

## Storybook And Browser Gates

Storybook focuses on component-state coverage. Browser Scenario Verification
focuses on browser-visible user journeys and safe targets.

Local TypeScript scripts do not call Playwright MCP. The Codex agent can perform
the browser scenario only when a Playwright MCP server registered in
`config.toml` is available at runtime. Otherwise the workflow records a plan and
leaves verification `approval-required` or `skipped`.

## Dry-run Default

Planning and reporting are dry-run by default. Branch creation or switching,
product/test edits, dependency or setup changes, Storybook story writes,
browser actions, commit, push, and PR creation require the relevant approval
gate.
