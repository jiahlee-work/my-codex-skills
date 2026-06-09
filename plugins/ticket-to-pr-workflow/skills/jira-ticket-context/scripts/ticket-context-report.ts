import {
  displayTicketAssignee,
  displayTicketSpace,
  markdownList
} from "../../../shared/core/markdown.js";
import type { NormalizedTicket } from "../../../shared/types/ticket.js";
import type { Classification } from "./ticket-source.js";

function notesByPrefix(ticket: NormalizedTicket, prefix: string): string[] {
  return (ticket.notes ?? [])
    .filter((note) => note.startsWith(prefix))
    .map((note) => note.slice(prefix.length).trim())
    .filter(Boolean);
}

function asQuestion(value: string): string {
  const normalized = value.replace(/[.\s]+$/, "");
  return normalized.endsWith("?") ? normalized : `${normalized}?`;
}

function ticketContentSummary(ticket: NormalizedTicket): string {
  if (ticket.source === "jira") {
    return ticket.summary || ticket.title;
  }

  return ticket.description?.trim() || ticket.summary || ticket.title;
}

function missingInformation(ticket: NormalizedTicket): string[] {
  const missing: string[] = [];

  if (!ticket.description?.trim()) {
    missing.push("Detailed ticket description is missing.");
  }

  if (ticket.acceptanceCriteria.length === 0) {
    missing.push("Acceptance criteria are missing.");
  }

  missing.push(...notesByPrefix(ticket, "Open question:"));
  return missing;
}

function riskHints(
  ticket: NormalizedTicket,
  classification: Classification
): string[] {
  const explicitRisks = notesByPrefix(ticket, "Risk area:");
  const blockers = (ticket.blockers ?? []).map((blocker) => `Blocker: ${blocker}`);

  if (
    explicitRisks.length === 0 &&
    blockers.length === 0 &&
    classification.readiness === "risky"
  ) {
    return ["Risk-sensitive area detected from ticket content."];
  }

  return [...explicitRisks, ...blockers];
}

function questionsForUser(ticket: NormalizedTicket): string[] {
  const questions = notesByPrefix(ticket, "Open question:").map(asQuestion);

  if (!ticket.description?.trim()) {
    questions.push("What implementation details or constraints should be added to the ticket?");
  }

  if (ticket.acceptanceCriteria.length === 0) {
    questions.push("What acceptance criteria should be used for this ticket?");
  }

  return questions;
}

export function renderTicketContextReport(
  ticket: NormalizedTicket,
  classification: Classification
): string {
  return `# Ticket Context Report

## Ticket

${ticket.key} ${ticket.title}

## Source

- Source: ${ticket.source}
- Space: ${displayTicketSpace(ticket)}
- Assignee: ${displayTicketAssignee(ticket)}

## Ticket Content Summary

${ticketContentSummary(ticket)}

## Explicit Requirements

${markdownList(ticket.acceptanceCriteria)}

## Missing Information

${markdownList(missingInformation(ticket))}

## Risk Hints

${markdownList(riskHints(ticket, classification))}

## Questions for User

${markdownList(questionsForUser(ticket))}
`;
}
