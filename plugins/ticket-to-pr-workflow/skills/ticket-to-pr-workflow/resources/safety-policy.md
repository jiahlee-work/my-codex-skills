# Safety Policy

## Read-only And Planning Work

Allowed without a mutation approval:

- Read Jira ticket data through read-only MCP tools.
- Normalize direct chat input through Manual Ticket Intake.
- Classify tickets and generate reports under `.agent-runs`.
- Generate and validate proposed branch names and commit messages.
- Detect test and Storybook setup.
- Generate setup proposals, test plans, branch plans, scenario plans, and
  reports.
- Run already-approved local checks.

Do not substitute unrelated ticket data when intake fails.

## Active Run State

`.agent-runs/.active-run.json` is local runtime state. Its source is `jira` or
`manual`, and it may contain displayed ticket metadata, user intent, local
paths, approvals, and blockers. Never commit it or include unsanitized state in
documentation.

## Planning Restrictions

Before Branch Preparation is resolved, do not:

- create or switch branches
- modify product or test files
- install dependencies
- change package, lock, environment, build, test, or setup files
- run Playwright MCP
- commit, push, or create a PR
- deploy, release, or mutate Jira

Missing requirements must stop for clarification. Do not invent acceptance
criteria.

## Branch Preparation And Code Work

Before product or test edits:

- require ticket context, user intent, task spec, test plan, and
  `branch-commit-plan.md`
- inspect Git status
- validate the selected branch
- stop on protected branches or unrelated dirty changes
- obtain approval when branch creation or switching is required

After the working branch is confirmed, ticket-scoped product and focused test
changes are allowed. Full verification, commit, push, PR creation, Jira
mutation, and Playwright MCP remain disallowed during code work.

## Local Verification

Run only repository-provided or already-approved local verification commands.
Write logs and reports under the selected agent run. Do not modify product,
test, dependency, package, lockfile, environment, build, test configuration, or
setup files during verification.

## Storybook

Detect and plan first. Dependency, package, lockfile, `.storybook`, config, and
story changes require explicit setup or story-write approval. Storybook work
does not approve browser actions or delivery.

## Browser Verification

Playwright MCP may be used only by the Codex agent runtime when it is registered
in `config.toml`, available, and the browser action gate is resolved. Local
TypeScript scripts must not call MCP.

Allowed targets are localhost, `127.0.0.1`, local preview, or explicitly
approved staging. Production access, real payment, real email, destructive data
mutation, account deletion, permission changes, secret reads, and real-user
data changes are forbidden.

## PR Dry-run And Execution

Generate commit and PR dry-run artifacts only after local verification,
Storybook, and Browser gates are resolved.

Commit, push, and PR creation require:

- a non-protected working branch
- passed local verification
- resolved Storybook and Browser reports
- approved skips where applicable
- no secret paths or unapproved package/lockfile changes
- valid commit policy
- explicit final user approval

Never force push, wait for GitHub Actions, deploy, release, or mutate Jira as
part of this workflow.
