import {
  createAgentRunDir,
  relativeToProject
} from "../../../shared/core/artifact-path.js";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import {
  readJsonFile,
  writeTextFile
} from "../../../shared/core/fs.js";
import {
  displayTicketAssignee,
  displayTicketSpace,
  markdownList
} from "../../../shared/core/markdown.js";
import type { NormalizedTicket } from "../../../shared/types/ticket.js";
import { renderBranchCommitPlan } from "../../branch-commit-policy/scripts/branch-commit-policy.js";
import { renderTicketContextReport } from "../../jira-ticket-context/scripts/ticket-context-report.js";
import {
  classifyTickets,
  type Classification,
  parseInputPathArg,
  parseTicketKeyArg,
  type TicketCollection,
  writeTicketProcessingFailureRun
} from "../../jira-ticket-context/scripts/ticket-source.js";

function notesByPrefix(ticket: NormalizedTicket, prefix: string): string[] {
  return (ticket.notes ?? [])
    .filter((note) => note.startsWith(prefix))
    .map((note) => note.slice(prefix.length).trim());
}

async function renderRequirementSummary(
  ticket: NormalizedTicket,
  classification: Classification
): Promise<string> {
  const description =
    ticket.source === "jira"
      ? "The Jira description is not persisted in planning artifacts. Acceptance criteria are parsed when available."
      : ticket.description || "None";
  const notes =
    ticket.source === "jira"
      ? ["Jira comments are not persisted by default.", ...(ticket.notes ?? [])]
      : ticket.notes;

  return `# Requirement Summary

## Ticket

- Key: ${ticket.key}
- Work type: ${ticket.workType}
- Title: ${ticket.title}
- Source: ${ticket.source}
- Space: ${displayTicketSpace(ticket)}
- Assignee: ${displayTicketAssignee(ticket)}
- Readiness: ${classification.readiness}
- Approval mode: ${classification.recommendedApprovalMode}
- Verification mode: ${classification.recommendedVerificationMode}

## Description

${description}

## Acceptance Criteria

${markdownList(ticket.acceptanceCriteria)}

## Dependencies

${markdownList(notesByPrefix(ticket, "External dependency:"))}

## Risks

${markdownList(notesByPrefix(ticket, "Risk area:"))}

## Ambiguities

${markdownList(notesByPrefix(ticket, "Open question:"))}

## Notes

${markdownList(notes)}
`;
}

function renderTaskSpec(ticket: NormalizedTicket, classification: Classification): string {
  const inScope =
    ticket.source === "jira"
      ? [
          "Confirm implementation scope from the Jira summary and parsed Acceptance Criteria.",
          "Keep implementation behind the user-approved plan."
        ]
      : notesByPrefix(ticket, "Frontend scope:");
  const verificationCommands =
    classification.recommendedVerificationMode === "light"
      ? ["pnpm lint", "pnpm typecheck", "pnpm test"]
      : ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "pnpm playwright test"];

  return `# Task Spec

## Objective

Prepare implementation for ${ticket.key}: ${ticket.title}.

## In Scope

${markdownList(inScope)}

## Out Of Scope

- Jira ticket mutation.
- Jira comments, status changes, field updates, sprint changes, or assignee changes.
- Branch creation, commit creation, PR creation, or deployment in Planning.
- Playwright MCP execution in Planning.

## Acceptance Criteria

${markdownList(ticket.acceptanceCriteria)}

## Dependencies

${markdownList(notesByPrefix(ticket, "External dependency:"))}

## Ambiguities

${markdownList(notesByPrefix(ticket, "Open question:"))}

## Risks

${markdownList(notesByPrefix(ticket, "Risk area:"))}

## Recommended Approval

- Mode: ${classification.recommendedApprovalMode}
- Reason: ${classification.reasons.join("; ")}

## Test Plan Draft

${markdownList([
  ...ticket.acceptanceCriteria.map((criterion) => `Verify: ${criterion}`),
  ...verificationCommands.map((command) => `Run \`${command}\` when available in the target repository.`)
])}
`;
}

function renderPlanCriticReport(
  ticket: NormalizedTicket,
  classification: Classification
): string {
  const ambiguities = notesByPrefix(ticket, "Open question:");
  const dependencies = notesByPrefix(ticket, "External dependency:");
  const risks = notesByPrefix(ticket, "Risk area:");

  return `# Plan Critic Report

## Classification Review

- Readiness: ${classification.readiness}
- Approval mode: ${classification.recommendedApprovalMode}
- Verification mode: ${classification.recommendedVerificationMode}

## Ambiguities

${markdownList(
  ambiguities.length > 0
    ? ambiguities
    : classification.readiness === "needs_clarification"
      ? ["Clarify missing or ambiguous requirements before implementation."]
      : []
)}

## Dependencies

${markdownList(dependencies)}

## Risks

${markdownList(
  risks.length > 0
    ? risks
    : classification.readiness === "risky"
      ? ["Risk-sensitive area detected by ticket text or metadata."]
      : []
)}

## Critic Checks

- Confirm every Acceptance Criterion maps to an implementation step and a test scenario.
- Confirm dependencies have owners or explicit assumptions.
- Confirm risky changes use full verification and strict review.
- Confirm the branch type is based on expected code changes, not Jira work type.

## Review Recommendation

${
  classification.recommendedApprovalMode === "strict-review"
    ? "Require approval for the plan, test scenarios, branch and commit plan, implementation, and diff."
    : "Run plan review and critic review, then request approval before implementation."
}
`;
}

function renderTicketContextRunSection(
  collection: TicketCollection,
  ticket: NormalizedTicket,
  classification: Classification
): string {
  return `- Status: selected
- Updated at: ${new Date().toISOString()}
- Ticket: ${ticket.key}
- Title: ${ticket.title}
- Source: ${ticket.source}
- Jira read mode: ${ticket.source === "jira" ? "read-only" : "not used"}
- Jira mutation: ${ticket.source === "jira" ? "disabled" : "not used"}
- Jira space: ${ticket.source === "jira" ? displayTicketSpace(ticket) : "not used"}
- Assignee: ${displayTicketAssignee(ticket)}
- Readiness: ${classification.readiness}
- JQL: ${collection.jira?.jql ?? "not used"}
- Search tool: ${collection.jira?.searchTool ?? "not used"}

### Generated Artifacts

- ticket-context-report.md

### Boundary

- Jira ticket mutation was not performed.
- Jira comments, status changes, assignee changes, sprint changes, and field updates were not performed.`;
}

function renderPlanningRunSection(
  ticket: NormalizedTicket,
  classification: Classification
): string {
  return `- Status: planning-created
- Updated at: ${new Date().toISOString()}
- Ticket: ${ticket.key}
- Approval mode: ${classification.recommendedApprovalMode}
- Verification mode: ${classification.recommendedVerificationMode}

### Generated Artifacts

- requirement-summary.md
- task-spec.md
- plan-critic-report.md
- branch-commit-plan.md

### Planning Boundary

- Product code implementation was not performed.
- Branch creation, commit creation, PR creation, deployment, and Playwright MCP execution were not performed.`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ticketKey = parseTicketKeyArg(args);

  if (!ticketKey) {
    console.error(
      "Usage: generate-planning-artifacts.ts <ticketKey> --input <normalized-ticket-collection.json>"
    );
    process.exitCode = 1;
    return;
  }

  const collection = await readJsonFile<TicketCollection>(
    parseInputPathArg(args)
  );
  const selectedTicket = collection.tickets.find((ticket) => ticket.key === ticketKey);

  if (!selectedTicket) {
    console.error(`Ticket not found: ${ticketKey}`);
    process.exitCode = 1;
    return;
  }

  const classifications = classifyTickets(collection.tickets);
  const selectedClassification = classifications.find((item) => item.key === ticketKey);

  if (!selectedClassification) {
    console.error(`Classification not found: ${ticketKey}`);
    process.exitCode = 1;
    return;
  }

  const runDir = await createAgentRunDir(ticketKey);
  await writeTextFile(
    runDir,
    "ticket-context-report.md",
    renderTicketContextReport(selectedTicket, selectedClassification)
  );
  await writeTextFile(
    runDir,
    "requirement-summary.md",
    await renderRequirementSummary(selectedTicket, selectedClassification)
  );
  await writeTextFile(
    runDir,
    "task-spec.md",
    renderTaskSpec(selectedTicket, selectedClassification)
  );
  await writeTextFile(
    runDir,
    "plan-critic-report.md",
    renderPlanCriticReport(selectedTicket, selectedClassification)
  );
  await writeTextFile(
    runDir,
    "branch-commit-plan.md",
    renderBranchCommitPlan(selectedTicket)
  );
  await updateAgentRunReportSection(
    runDir,
    "Ticket Context",
    renderTicketContextRunSection(collection, selectedTicket, selectedClassification)
  );
  await updateAgentRunReportSection(
    runDir,
    "Planning",
    renderPlanningRunSection(selectedTicket, selectedClassification)
  );

  console.log(
    JSON.stringify(
      {
        ticketKey,
        source: collection.source,
        outputDir: relativeToProject(runDir),
        files: [
          "ticket-context-report.md",
          "requirement-summary.md",
          "task-spec.md",
          "plan-critic-report.md",
          "branch-commit-plan.md",
          "agent-run-report.md"
        ]
      },
      null,
      2
    )
  );
}

main().catch(async (error: unknown) => {
  const outputDir = await writeTicketProcessingFailureRun(
    "planning-generate",
    error
  );
  console.error(`${error instanceof Error ? error.message : String(error)}\nFailure report: ${outputDir}`);
  process.exitCode = 1;
});
