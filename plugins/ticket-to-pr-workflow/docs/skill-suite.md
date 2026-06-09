# Skill Suite

## ticket-to-pr-workflow

**Responsibility:** Acts as the parent orchestrator. It manages child skill
order and approval gates using the Codex App conversation,
`.agent-runs/.active-run.json`, and agent-run artifacts.

**Inputs:** Jira selection or manual ticket context, user intent, target
repository, and active-run state.

**Outputs:** Staged artifact flow, clarification, approval, and skip states,
the final approval gate, and agent-run report updates.

**Does not own:** Duplicate child skill implementation, unapproved repository
mutation, commit, push, or PR execution.

## jira-ticket-context

**Responsibility:** Reads Jira tickets through the read-only Jira MCP registered
in Codex `config.toml`, then normalizes ticket context and readiness.

**Inputs:** A user-selected Jira MCP space and an optional ticket key. Context
provided by the parent's Manual Ticket Intake can also be normalized into the
same ticket-like shape.

**Outputs:** `assigned-ticket-list.json`, `ticket-context-report.md`, and
normalized ticket metadata.

**Does not own:** Jira mutation, automatic space selection, or implementation
work.

## task-spec-planner

**Responsibility:** Converts ticket context and user implementation intent into
requirements, a task specification, and a plan critic report.

**Inputs:** Normalized ticket, acceptance criteria, readiness classification,
and user intent.

**Outputs:** `requirement-summary.md`, `task-spec.md`,
`plan-critic-report.md`, and optional `user-implementation-intent.md`.

**Does not own:** Code changes, test execution, or PR execution.

## test-plan-worker

**Responsibility:** Detects the test environment and creates either a setup
proposal or a test plan.

**Inputs:** Planning artifacts, user implementation intent, and repository
setup.

**Outputs:** `test-environment-report.md`, `test-setup-proposal.md`, and
`test-plan.md`.

**Does not own:** Unapproved dependency installation, package, configuration,
or setup changes, product or test code changes, or full verification.

## branch-commit-policy

**Responsibility:** Proposes and validates branch-name and commit-message
policies before product or test code changes.

**Inputs:** Ticket key, task and test plans, branch candidates, and commit
message candidates.

**Outputs:** `branch-commit-plan.md` and validation results.

**Does not own:** Unapproved branch creation or switching, commit, or push.

## ticket-code-worker

**Responsibility:** Creates ticket-scoped product and test changes on a
confirmed working branch, then records the diff, implementation details, and
risks.

**Inputs:** Planning artifacts, test plan, confirmed branch plan, user intent,
and target repository.

**Outputs:** `implementation-summary.md`, `code-review-report.md`,
`diff-summary.md`, `changed-files.json`, and `risk-detection-report.md`.

**Does not own:** File changes before branch confirmation, full verification,
commit, push, or PR creation.

## verification-runner

**Responsibility:** Resolves and runs the repository's local verification
commands, then analyzes failures.

**Inputs:** Implementation artifacts, test environment report, and test plan.

**Outputs:** `verification-report.md`, optional `failure-report.md`, and
verification logs.

**Does not own:** Code modification, dependency installation, commit, push, PR
creation, or Playwright MCP execution.

## storybook-verifier

**Responsibility:** Manages Storybook setup, story planning, and component-state
verification.

**Inputs:** Changed files, implementation summary, verification report, and
existing Storybook setup.

**Outputs:** `storybook-environment-report.md`, `storybook-plan.md`,
`storybook-report.md`, and optional `stories-changed.json`.

**Does not own:** Unapproved dependency, configuration, or story-file changes,
or browser scenario verification.

## browser-scenario-verifier

**Responsibility:** Determines whether browser verification is required and
creates the scenario plan and report. Actual browser actions run only when the
Playwright MCP registered in Codex `config.toml` is available to the agent
runtime.

**Inputs:** `task-spec.md`, `test-plan.md`, `changed-files.json`,
`implementation-summary.md`, `verification-report.md`, and an optional
Storybook report.

**Outputs:** `browser-scenario-plan.md`, `browser-verification-report.md`, and
Browser Verification status updates for the PR and agent-run reports.

**Does not own:** A local MCP client, Playwright installation, a project-level
Playwright fallback runner, or production mutation.

## pr-reporting

**Responsibility:** Creates a dry-run commit plan, PR description, and PR plan
after the Storybook and Browser gates are resolved, then handles the execution
gate after final approval.

**Inputs:** Verification results, diff artifacts, branch and commit plan, and
Storybook and Browser Verification reports.

**Outputs:** `commit-plan.md`, `pr-description.md`, `pr-plan.md`, and the final
`agent-run-report.md`.

**Does not own:** Commit, push, or PR execution without approval, or code, test,
or package changes.
