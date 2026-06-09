import { describe, expect, it } from "vitest";
import type { NormalizedTicket } from "../plugins/ticket-to-pr-workflow/shared/types/ticket.js";
import type { Classification } from "../plugins/ticket-to-pr-workflow/skills/jira-ticket-context/scripts/ticket-source.js";
import { renderTicketContextReport } from "../plugins/ticket-to-pr-workflow/skills/jira-ticket-context/scripts/ticket-context-report.js";

const classification: Classification = {
  key: "FE-123",
  title: "Login failure message",
  space: "FE",
  assignee: "J Lee",
  readiness: "risky",
  executionMode: "strict-review",
  verificationMode: "full",
  recommendedApprovalMode: "strict-review",
  recommendedVerificationMode: "full",
  reasons: ["Risk-sensitive area detected."]
};

describe("renderTicketContextReport", () => {
  it("renders the selected ticket using the ticket context section order", () => {
    const ticket: NormalizedTicket = {
      key: "FE-123",
      title: "Login failure message",
      workType: "Bug",
      space: { key: "FE", name: "Frontend" },
      assignee: { displayName: "J Lee" },
      summary: "Show a login failure message",
      description: "Show a clear message when login fails.",
      acceptanceCriteria: ["A failed login shows an inline error message."],
      notes: [
        "Open question: Confirm the final error message copy.",
        "Risk area: authentication UI"
      ],
      blockers: [],
      source: "manual"
    };

    const report = renderTicketContextReport(ticket, classification);

    expect(report).toContain("# Ticket Context Report");
    expect(report).toContain("## Ticket\n\nFE-123 Login failure message");
    expect(report).toContain("- Source: manual\n- Space: FE\n- Assignee: J Lee");
    expect(report).toContain("## Ticket Content Summary\n\nShow a clear message when login fails.");
    expect(report).toContain(
      "## Explicit Requirements\n\n- A failed login shows an inline error message."
    );
    expect(report).toContain(
      "## Missing Information\n\n- Confirm the final error message copy."
    );
    expect(report).toContain("## Risk Hints\n\n- authentication UI");
    expect(report).toContain(
      "## Questions for User\n\n- Confirm the final error message copy?"
    );
    expect(report).not.toContain("Ticket Triage Report");
  });

  it("uses Jira summary metadata and exposes missing context without persisting a description", () => {
    const ticket: NormalizedTicket = {
      key: "POSE-4",
      title: "기초 세팅",
      workType: "Epic",
      space: { key: "POSE", name: "실시간 사진 촬영 디렉팅 앱" },
      assignee: { displayName: "jiahlee.work" },
      summary: "기초 세팅",
      acceptanceCriteria: [],
      notes: [],
      blockers: [],
      source: "jira"
    };

    const report = renderTicketContextReport(ticket, {
      ...classification,
      key: ticket.key,
      title: ticket.title,
      readiness: "needs_clarification"
    });

    expect(report).toContain("## Ticket Content Summary\n\n기초 세팅");
    expect(report).toContain("- Detailed ticket description is missing.");
    expect(report).toContain("- Acceptance criteria are missing.");
    expect(report).toContain(
      "- What implementation details or constraints should be added to the ticket?"
    );
    expect(report).toContain("- What acceptance criteria should be used for this ticket?");
  });
});
