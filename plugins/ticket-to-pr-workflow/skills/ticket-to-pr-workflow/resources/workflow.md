# Workflow

## Codex App Entry

1. Load `.agent-runs/.active-run.json` when it exists.
2. Interpret the current user message against `lastDisplayedTickets`,
   `nextAction`, `blockedBy`, and pending questions.
3. Start Jira MCP Intake when Jira is configured and the user asks for assigned
   tickets.
4. Start Manual Ticket Intake when Jira is unavailable or the user supplies a
   feature request directly.
5. Never substitute unrelated ticket data when intake fails.

Safe read-only analysis and `.agent-runs` artifact generation may auto-continue.
Repository mutations, browser actions, delivery actions, and missing
requirements must stop at their explicit gates.

## Intake And Context

1. For Jira, list MCP-visible spaces and wait for the user to choose a scope.
2. Read only current-user assigned tickets from the selected space.
3. Present a numbered ticket list and persist it in active-run state.
4. Resolve contextual selections against that list.
5. For manual intake, collect title, requirements, acceptance criteria,
   constraints, and intended behavior without inventing missing details.
6. Normalize the selected Jira ticket or manual context.
7. Generate `ticket-context-report.md` and update the active run.

## Intent And Planning

1. Clarify and record user implementation intent.
2. Generate `requirement-summary.md`, `task-spec.md`, and
   `plan-critic-report.md`.
3. Detect test setup and conventions.
4. Write `test-plan.md` when setup is sufficient.
5. When setup is insufficient, write `test-setup-proposal.md` and stop before
   dependency, package, lockfile, config, setup, product, or test changes.
6. Generate or refresh `branch-commit-plan.md`.

Sequence:

`NORMALIZE_TICKET_CONTEXT`
-> `CLARIFY_USER_INTENT`
-> `CREATE_TASK_SPEC`
-> `CREATE_TEST_PLAN_OR_PROPOSAL`
-> `CREATE_BRANCH_AND_COMMIT_PLAN`

## Branch Preparation

Branch Preparation is a distinct gate before product or test code work.

1. Load the complete ticket, intent, task, test, and branch plan artifacts.
2. Check the current branch and worktree status.
3. Validate the recommended branch name.
4. Stop when the branch is protected, the recommended branch does not exist,
   unrelated dirty changes are present, or creation/switching requires approval.
5. Ask whether to create and switch to the recommended branch, use an existing
   branch, provide a custom branch, or stop.
6. Record the decision in active-run state.
7. Confirm the working branch before permitting product or test edits.

Sequence:

`CHECK_GIT_STATUS`
-> `VALIDATE_BRANCH_POLICY`
-> `RESOLVE_BRANCH_APPROVAL`
-> `CONFIRM_WORKING_BRANCH`
-> `ALLOW_TICKET_CODE_WORK`

## Ticket-scoped Code Work

1. Require a confirmed non-protected working branch.
2. Analyze related code and existing test conventions.
3. Implement the minimal product and focused test changes within ticket scope.
4. Collect the diff and changed-file metadata.
5. Detect risky, unrelated, sensitive, large, and unapproved setup changes.
6. Write implementation and code review reports.
7. Stop before full local verification.

## Local Verification

1. Load the implementation artifacts.
2. Select light or full verification based on scope and risk.
3. Resolve repository-provided lint, typecheck, test, and build commands.
4. Run approved commands sequentially and record outputs and durations.
5. Analyze failures before any policy-allowed retry.
6. Write `verification-report.md` and optional `failure-report.md`.
7. Stop before Storybook, browser, commit, push, or PR actions.

## Storybook Gate

1. Detect existing Storybook setup and changed UI components.
2. Generate environment, setup proposal, and story planning artifacts first.
3. Stop before dependency, package, lockfile, `.storybook`, config, or story
   changes unless the relevant setup or story-write approval exists.
4. Run configured Storybook checks after approved work.
5. Write `storybook-report.md`.
6. Stop on `failed` or `approval-required`.

## Browser Gate

1. Decide whether browser verification is needed from ticket, test, diff,
   implementation, local verification, and Storybook artifacts.
2. Generate `browser-scenario-plan.md`.
3. Check target safety. Default to localhost, `127.0.0.1`, or local preview;
   staging requires explicit approval and production is forbidden.
4. If Playwright MCP registered in Codex `config.toml` is available to the
   agent runtime and browser action approval is resolved, perform the planned
   scenario in agent mode.
5. Local TypeScript scripts must not call Playwright MCP.
6. Without available Playwright MCP, record `approval-required` or `skipped`.
7. Write `browser-verification-report.md`.
8. Stop on `failed` or unresolved `approval-required`.

## PR Dry-run And Final Execution

1. Require local verification, Storybook, and Browser statuses to be resolved.
2. Recheck Git state, origin, secret paths, package approvals, and commit policy.
3. Generate and validate `commit-plan.md`.
4. Generate `pr-description.md` and `pr-plan.md`.
5. Keep all outputs dry-run and stop for final approval.
6. On explicit final approval, recheck every gate.
7. Execute commit, push, and PR creation only when all checks pass.
8. Finalize `agent-run-report.md`.

Sequence:

`LOCAL_VERIFICATION`
-> `STORYBOOK_VERIFICATION`
-> `BROWSER_SCENARIO_VERIFICATION`
-> `CREATE_COMMIT_AND_PR_PLAN`
-> `FINAL_PR_APPROVAL`
-> `EXECUTE_IF_APPROVED`
-> `FINALIZE_AGENT_RUN_REPORT`
