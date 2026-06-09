# Workflow Stage Roadmap

This roadmap describes the user-facing Codex App-native order. Child skill
phase numbers may remain in artifact names, but they must not change the gate
order below.

## 1. Ticket Intake via Jira MCP

Read assigned tickets through the Jira MCP server registered in Codex
`config.toml`. Show visible spaces and wait for the user to choose a scope.
Direct feature requests can enter through the parent's internal Manual Ticket
Intake policy.

## 2. Ticket Context Analysis

Normalize the selected Jira ticket or manual context, preserve acceptance
criteria, classify readiness, and write ticket context artifacts.

## 3. User Implementation Intent Clarification

Record the behavior the user expects, implementation constraints, and unresolved
questions. Do not invent missing requirements.

## 4. Task Spec Planning

Generate `requirement-summary.md`, `task-spec.md`, and
`plan-critic-report.md`.

## 5. Test Planning

Detect the test environment and write `test-plan.md` or a setup proposal.
Dependency, package, lockfile, config, setup, product, and test file changes
remain approval-gated.

## 6. Branch Preparation

Generate or refresh `branch-commit-plan.md`, validate the branch name, inspect
the worktree, and obtain any required branch creation or switch approval. Do
not change product or test files until the working branch is confirmed.

## 7. Ticket-scoped Code Work

On the confirmed branch, make only ticket-scoped product and focused test
changes. Collect changed files, diff summaries, implementation notes, review
findings, and risk reports, then stop before full verification.

## 8. Local Verification Automation

Resolve repository-provided lint, typecheck, test, and build commands. Record
results and failure analysis without committing or pushing.

## 9. Storybook Story Work and Component Verification

Detect Storybook and generate plans or reports first. Setup, dependency,
configuration, and story writes require explicit approval.

## 10. Browser Scenario Verification

Generate a browser scenario plan. The Codex agent performs real browser actions
only when the Playwright MCP server registered in `config.toml` is available and
the target is localhost or approved staging.

## 11. PR Dry-run Artifacts

After Storybook and Browser gates are resolved, generate `commit-plan.md`,
`pr-description.md`, and `pr-plan.md`. This stage does not commit, push, or
create a PR.

## 12. Commit/Push/PR Approval Gate

Recheck branch, verification, Storybook, Browser, secret, package, and remote
conditions. Execute commit, push, and PR creation only after explicit user
approval.

## 13. Final Reporting

Finalize the agent-run report with completed checks, remaining risks, gate
status, and delivery results.
