import { describe, expect, it } from "vitest";
import {
  renderBranchCommitPlan,
  validateCommitMessage
} from "../plugins/ticket-to-pr-workflow/skills/branch-commit-policy/scripts/branch-commit-policy.js";
import type { NormalizedTicket } from "../plugins/ticket-to-pr-workflow/shared/types/ticket.js";

function ticket(overrides: Partial<NormalizedTicket> = {}): NormalizedTicket {
  return {
    key: "FE-123",
    title: "Login failure message",
    workType: "Story",
    summary: "Show a login failure message",
    acceptanceCriteria: [],
    source: "manual",
    ...overrides
  };
}

describe("branch-commit-policy", () => {
  it("requires a lowercase type and Korean summary", () => {
    expect(
      validateCommitMessage("feat: 로그인 실패 메시지 표시\nRefs: FE-123", "FE-123")
    ).toEqual({ valid: true, errors: [] });

    expect(
      validateCommitMessage("Feat: 로그인 실패 메시지 표시\nRefs: FE-123", "FE-123")
        .errors
    ).toContain("Commit type must be lowercase.");
    expect(
      validateCommitMessage("feat: show login failure message\nRefs: FE-123", "FE-123")
        .errors
    ).toContain("Commit summary must be written in Korean.");
  });

  it("renders a valid Korean commit summary from Korean ticket content", () => {
    const plan = renderBranchCommitPlan(
      ticket({
        title: "로그인 실패 메시지 표시",
        summary: "로그인 실패 시 안내 메시지를 보여준다."
      })
    );

    expect(plan).toContain("feat: 로그인 실패 메시지 표시");
    expect(plan).toContain("- Validation: pass");
  });

  it("falls back to a Korean commit summary for English-only ticket content", () => {
    const plan = renderBranchCommitPlan(ticket());

    expect(plan).toContain("fix: 티켓 요구사항 구현");
    expect(plan).toContain("- Validation: pass");
  });
});
