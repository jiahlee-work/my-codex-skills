---
name: ticket-to-pr-workflow
description: Orchestrate a Codex App-native ticket-to-PR workflow across Jira or manual intake, planning, branch preparation, ticket-scoped implementation, verification, Storybook and browser gates, dry-run PR reporting, and final approval-gated delivery. Use when Codex must continue from conversation state and agent-run artifacts without duplicating child-skill logic.
---

# Ticket To PR Workflow

## When To Use

Use for an end-to-end Codex App workflow that turns a Jira ticket or direct user
request into traceable planning, implementation, verification, and delivery
artifacts under `.agent-runs`.

## Inputs

- Jira MCP ticket selection, direct Jira ticket key, or manual ticket context
  from the conversation
- User implementation intent
- Target repository
- Existing active-run state and phase artifacts, when present

## Outputs

- Planning, branch, implementation, verification, Storybook, browser, and PR
  artifacts under `.agent-runs/{ticketKey}-{timestamp}/`
- `.agent-runs/.active-run.json` runtime state
- Explicit approval, clarification, skip, and stop decisions

## Ticket Intake Policy

The parent skill supports two intake modes:

1. Jira MCP Intake
   - Use when Jira MCP is available and configured.
   - Support two user-facing triggers:
     - Assigned ticket selection: read assigned Jira tickets, present a
       numbered list, and resolve the selected ticket.
     - Direct ticket key: detect a standalone Jira key such as `ABC-123`, read
       that issue detail by exact key, and start from the normalized ticket.
   - For direct ticket keys, do not require the user to first list spaces or
     choose from assigned tickets.
   - Validate that the direct-key ticket is assigned to the current Jira user.
2. Manual Ticket Intake
   - Use when Jira MCP is unavailable, disconnected, or the user provides a
     feature request directly in chat.
   - Ask the user for the ticket title, requirements, acceptance criteria,
     constraints, and intended behavior.
   - Convert the provided chat context into a normalized ticket-like context.
   - Do not invent missing acceptance criteria.
   - Ask clarification questions before implementation if required details are
     missing.

Do not substitute unrelated ticket data when intake fails.

## Intent Routing

The parent skill should interpret short or contextual user replies from the
conversation context.

- A reply that refers to a listed ticket, such as "first one", "1", "1번", or
  "첫 번째", resolves against the last displayed ticket list.
- A reply that is a standalone Jira ticket key matching
  `[A-Z][A-Z0-9]+-\d+`, such as `ABC-123`, starts Direct Ticket Key Jira MCP
  Intake when it is not answering a pending approval, branch, or clarification
  prompt.
- A reply that indicates continuation, such as "continue", "go ahead",
  "진행해", or "계속해", applies only to the current safe `nextAction`.
- A reply that indicates approval applies only to the current `blockedBy` gate.
- A reply that indicates stopping or avoiding PR creation stops execution and
  records the decision.

Do not require the user to memorize exact commands.

## Active Run State

Persist resumable Codex App runtime state at `.agent-runs/.active-run.json`.
The state is local runtime data and must not be committed. Documentation and
examples may contain only sanitized values.

```ts
export type ActiveRunMode = "codex-app" | "script";
export type TicketIntakeSource = "jira" | "manual";

export type ActiveRunState = {
  mode: ActiveRunMode;
  source?: TicketIntakeSource;
  lastTicketListRun?: string;
  lastDisplayedTickets?: Array<{
    index: number;
    ticketKey: string;
    title: string;
    status?: string;
    priority?: string;
    workType?: string;
  }>;
  selectedTicketKey?: string;
  manualTicketContext?: {
    title?: string;
    summary?: string;
    requirements?: string[];
    acceptanceCriteria?: string[];
    constraints?: string[];
    userIntent?: string;
  };
  activeRunDir?: string;
  currentPhase?: number;
  nextAction?: string;
  blockedBy?: string | null;
  pendingQuestions?: string[];
  approvals?: Array<{
    gate: string;
    approvedAt: string;
    note?: string;
  }>;
  skips?: Array<{
    gate: string;
    skippedAt: string;
    reason?: string;
  }>;
  updatedAt: string;
};
```

Refresh `updatedAt`, `currentPhase`, `nextAction`, and `blockedBy` after each
transition. Preserve the last displayed Jira ticket list until selection is
resolved or intake is restarted. Persist direct-key intake by setting
`selectedTicketKey` without requiring `lastDisplayedTickets`.

## Auto-Continue Policy

After ticket selection, direct ticket key resolution, or manual intake, continue
through phases without asking for confirmation while the next phase only reads
files, analyzes context, writes `.agent-runs` artifacts, or runs
already-approved local checks.

Stop only at approval or clarification gates that would mutate repository
setup, create or switch branches, edit product/test files, run browser actions,
commit, push, create PRs, access production URLs, or require missing user input.

## Branch Preparation Policy

After ticket context, user implementation intent, task spec, test plan, and
`branch-commit-plan.md` are available, prepare the working branch before
product or test code changes.

The parent skill must:

1. Generate or refresh `branch-commit-plan.md`.
2. Check the current Git worktree status.
3. Stop before code modification if:
   - the current branch is protected, such as `main` or `master`
   - the recommended branch does not exist
   - the worktree has unrelated dirty changes
   - branch creation or branch switching requires user approval
4. Ask the user whether to create and switch to the recommended branch, use an
   existing branch, provide a custom branch name, or stop.

Do not modify product or test files until branch state is confirmed. Validate
the chosen branch name with `branch-commit-policy` before creation or switching.

## Target Repository Execution

Treat the repository currently open in Codex as the target repository. Run
packaged helpers with that repository as the working directory and pass its path
through `--root` and `--repo` whenever the helper supports those options. Never
create `.agent-runs` or apply ticket changes inside the installed plugin.

## Main Steps

1. Use `jira-ticket-context` for read-only Jira intake through assigned-ticket
   selection or direct ticket key detail lookup, or normalize direct chat input
   through Manual Ticket Intake.
2. Use `task-spec-planner` for Requirement Summary, Task Spec, and Plan Critic
   Report.
3. Clarify and record user implementation intent without inventing missing
   acceptance criteria.
4. Use `test-plan-worker` for test environment detection, setup proposals, and
   test plans.
5. Use `branch-commit-policy` to generate and validate
   `branch-commit-plan.md`, then resolve the Branch Preparation gate.
6. Use `ticket-code-worker` only after the working branch is confirmed.
7. Use `verification-runner` for local verification and reports.
8. Use `storybook-verifier` for component-state planning and verification.
9. Use `browser-scenario-verifier` for scenario planning and Playwright MCP
   agent-mode verification when available through Codex configuration.
10. Use `pr-reporting` for dry-run commit and PR artifacts after Storybook and
    Browser gates are resolved.
11. Return to `pr-reporting` for final approval-gated commit, push, and PR
    execution, then finalize the Agent Run Report.

For Jira assigned-ticket selection, do not choose a space on the user's behalf.
Let `jira-ticket-context` list MCP-visible spaces and collect the selection
first. For direct ticket key intake, the exact issue key is the user-selected
scope; read that issue detail by key and do not query all spaces or broaden the
search.

## Related Resources

- `resources/workflow.md`
- `resources/approval-mode-policy.md`
- `resources/reasoning-policy.md`
- `resources/safety-policy.md`
- `resources/artifact-policy.md`

## Child Skill Map

- `browser-scenario-verifier` -> browser verification need decision, browser
  scenario planning, Playwright MCP agent-mode guidance, and Browser
  Verification Report generation.
