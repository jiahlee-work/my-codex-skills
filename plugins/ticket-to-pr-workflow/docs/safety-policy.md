# Safety Policy

## Dry-run First

The workflow defaults to planning and reporting. PR artifacts are dry-run by
default. Actual commit, push, and PR creation require final explicit approval
after Storybook and Browser Verification gates are resolved.

## Sensitive Data

Do not commit:

- real Jira ticket data
- real user information
- actual company or PR URLs
- MCP authentication data
- environment variables
- raw agent-run logs or active-run state
- secrets or tokens

## Runtime Data

The target repository should exclude `.agent-runs`, `.env`, personal Codex
configuration, logs, browser artifacts, Playwright reports, test results, and
Playwright MCP snapshots.

`.agent-runs/.active-run.json` is local runtime state and must remain
uncommitted.

## Jira

Jira MCP must be registered in Codex `config.toml` for Jira intake. Its use is
read-only: show visible spaces, wait for user selection, and read assigned
tickets only from that scope. Do not mutate tickets, comments, status,
assignees, or project settings.

If Jira is unavailable, the parent may normalize a direct user request through
Manual Ticket Intake. It must not invent acceptance criteria.

## Branch Preparation

Before product or test code changes:

- generate or refresh `branch-commit-plan.md`
- inspect the current branch and worktree
- validate the proposed branch name
- obtain approval for branch creation or switching when required
- stop on protected branches or unrelated dirty changes

No product or test file may be changed until the working branch is confirmed.

## Dependencies And Package Files

Do not install dependencies or change `package.json`, lockfiles, config, setup,
product, or test files without the approval required by the active phase.

## Storybook

Storybook setup and story writing are approval-gated. Missing setup creates a
proposal first. Writing stories or changing Storybook configuration requires
explicit approval.

## Browser Verification

Playwright MCP must be registered in Codex `config.toml` and available to the
Codex agent runtime for real browser actions. Local TypeScript scripts do not
call Playwright MCP.

Targets are limited to localhost, `127.0.0.1`, local preview, or explicitly
approved staging. Production URLs, real payments, real emails, destructive data
changes, account deletion, permission changes, and secret reads are forbidden.

Without Playwright MCP, generate the browser scenario plan and record browser
verification as `approval-required` or `skipped`.

## PR Execution

Generate commit and PR dry-run artifacts after Storybook and Browser gates are
resolved. Stop actual execution when either gate is `failed` or
`approval-required`. A skipped gate requires explicit user confirmation.
