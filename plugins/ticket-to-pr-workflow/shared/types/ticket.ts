export type TicketSource = "jira" | "manual";

export type JiraWorkType =
  | "Epic"
  | "Bug"
  | "Feature"
  | "Request"
  | "Story"
  | "Task"
  | string;

export type NormalizedTicket = {
  key: string;
  title: string;
  workType: JiraWorkType;
  priority?: string;
  status?: string;
  space?: {
    key?: string;
    name?: string;
  };
  assignee?: {
    accountId?: string;
    displayName?: string;
    email?: string;
  };
  reporter?: {
    accountId?: string;
    displayName?: string;
    email?: string;
  };
  summary: string;
  description?: string;
  acceptanceCriteria: string[];
  notes?: string[];
  comments?: string[];
  blockers?: string[];
  source: TicketSource;
  raw?: unknown;
};
