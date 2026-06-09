import { describe, expect, it } from "vitest";
import {
  buildAssignedJql,
  formatJiraSpaceList,
  matchJiraSpace,
  normalizeJiraAssignedTicketResponse,
  normalizeVisibleJiraSpaces
} from "../plugins/ticket-to-pr-workflow/skills/jira-ticket-context/scripts/ticket-source.js";

const context = {
  currentUser: {
    accountId: "current-user",
    displayName: "Current User"
  },
  selectedSpace: {
    id: "10000",
    key: "APP",
    name: "Application"
  },
  tools: [
    "atlassianUserInfo",
    "getVisibleJiraProjects",
    "searchJiraIssuesUsingJql"
  ],
  searchTool: "searchJiraIssuesUsingJql",
  generatedAt: "2026-06-10T00:00:00.000Z"
};

function jiraIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: "APP-42",
    fields: {
      summary: "Show a retry action",
      description:
        "The error state should offer a retry.\n\nAcceptance Criteria\n- Retry is visible after a failed request.",
      issuetype: { name: "Story" },
      priority: { name: "High" },
      status: { name: "In Progress" },
      project: { key: "APP", name: "Application" },
      assignee: {
        accountId: "current-user",
        displayName: "Current User"
      },
      reporter: {
        accountId: "reporter",
        displayName: "Reporter"
      },
      ...overrides
    }
  };
}

describe("Jira agent response normalization", () => {
  it("normalizes visible spaces without creating an MCP client", () => {
    const spaces = normalizeVisibleJiraSpaces(
      {
        values: [
          { id: "2", key: "WEB", name: "Web" },
          { id: "1", key: "APP", name: "Application" }
        ]
      },
      { APP: 3 }
    );

    expect(spaces).toEqual([
      {
        id: "1",
        key: "APP",
        name: "Application",
        assignedTicketCount: 3
      },
      {
        id: "2",
        key: "WEB",
        name: "Web",
        assignedTicketCount: undefined
      }
    ]);
    expect(formatJiraSpaceList(spaces)).toContain(
      "1. Application(APP): 3 tickets"
    );
    expect(matchJiraSpace(spaces, "2")?.key).toBe("WEB");
    expect(matchJiraSpace(spaces, "app")?.name).toBe("Application");
  });

  it("normalizes an Agent-provided assigned-ticket response", () => {
    const collection = normalizeJiraAssignedTicketResponse(
      { issues: [jiraIssue()] },
      context
    );

    expect(collection.generatedAt).toBe("2026-06-10T00:00:00.000Z");
    expect(collection.count).toBe(1);
    expect(collection.tickets[0]).toMatchObject({
      key: "APP-42",
      title: "Show a retry action",
      workType: "Story",
      source: "jira",
      acceptanceCriteria: ["Retry is visible after a failed request."]
    });
    expect(collection.jira).toMatchObject({
      jql: buildAssignedJql("APP"),
      selectedSpace: context.selectedSpace,
      readMode: "read-only",
      mutation: "disabled",
      searchTool: "searchJiraIssuesUsingJql"
    });
  });

  it("rejects tickets outside the selected space", () => {
    expect(() =>
      normalizeJiraAssignedTicketResponse(
        {
          issues: [
            jiraIssue({
              project: { key: "OTHER", name: "Other" }
            })
          ]
        },
        context
      )
    ).toThrow("outside the selected Jira space");
  });

  it("rejects tickets not assigned to the current Jira user", () => {
    expect(() =>
      normalizeJiraAssignedTicketResponse(
        {
          issues: [
            jiraIssue({
              assignee: {
                accountId: "different-user",
                displayName: "Different User"
              }
            })
          ]
        },
        context
      )
    ).toThrow("does not match current Jira user");
  });
});
