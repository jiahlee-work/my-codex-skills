import path from "node:path";
import {
  createAgentRunDir,
  relativeToProject
} from "../../../shared/core/artifact-path.js";
import { writeJsonFile, writeTextFile } from "../../../shared/core/fs.js";
import type {
  NormalizedTicket,
  TicketSource
} from "../../../shared/types/ticket.js";

export type { NormalizedTicket, TicketSource } from "../../../shared/types/ticket.js";
export type Readiness = "ready" | "needs_clarification" | "blocked" | "risky";
export type ExecutionMode = "plan-review" | "strict-review";
export type VerificationMode = "light" | "full";

export type TicketCollection = {
  source: TicketSource;
  generatedAt: string;
  count: number;
  tickets: NormalizedTicket[];
  assignee?: string;
  currentUser?: NormalizedUser;
  jira?: JiraRunMetadata;
};

export type Classification = {
  key: string;
  title: string;
  space?: string;
  assignee?: string;
  readiness: Readiness;
  executionMode: ExecutionMode;
  verificationMode: VerificationMode;
  recommendedApprovalMode: ExecutionMode;
  recommendedVerificationMode: VerificationMode;
  reasons: string[];
};

export type NormalizedUser = {
  accountId?: string;
  displayName?: string;
  email?: string;
};

export type JiraRunMetadata = {
  cloudId?: string;
  siteUrl?: string;
  jql?: string;
  selectedSpace?: JiraSpace;
  grantedScopes: string[];
  readMode: "read-only";
  mutation: "disabled";
  tools: string[];
  searchTool?: string;
};

export type JiraSpace = {
  id?: string;
  key: string;
  name: string;
  assignedTicketCount?: number;
};

export type JiraAgentContext = {
  currentUser: NormalizedUser;
  selectedSpace: JiraSpace;
  cloudId?: string;
  siteUrl?: string;
  jql?: string;
  grantedScopes?: string[];
  tools?: string[];
  searchTool?: string;
  generatedAt?: string;
};

export const jiraSpaceSelectionPrompt =
  "지라 티켓 목록을 확인할 space의 번호, 이름 또는 key를 입력하세요: ";

const acceptanceSectionNames = [
  "Acceptance Criteria",
  "AC",
  "완료 조건",
  "수용 기준",
  "검수 조건"
];
const riskyTerms = [
  "auth",
  "authentication",
  "authorization",
  "permission",
  "permissions",
  "admin",
  "payment",
  "checkout",
  "billing",
  "security",
  "delete",
  "deletion",
  "role",
  "access",
  "권한",
  "인증",
  "결제",
  "보안",
  "삭제",
  "관리자"
];
const clarificationTerms = [
  "unclear",
  "missing",
  "not confirmed",
  "not included",
  "pending",
  "tbd",
  "ambiguous",
  "확정",
  "미정",
  "불명확",
  "확인 필요"
];

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = stringValue(value);
    if (result) {
      return result;
    }
  }

  return undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeEmail(value?: string): string | undefined {
  return value?.trim().toLowerCase();
}

function personFromJira(value: unknown): NormalizedUser | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const person = value as Record<string, unknown>;
  const normalized = {
    accountId: firstString(person.accountId, person.account_id),
    displayName: firstString(person.displayName, person.display_name, person.name),
    email: firstString(person.emailAddress, person.email)
  };

  return normalized.accountId || normalized.displayName || normalized.email
    ? normalized
    : undefined;
}

function plainTextFromAdf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(plainTextFromAdf).filter(Boolean).join("\n");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const node = value as Record<string, unknown>;
  const ownText = typeof node.text === "string" ? node.text : "";
  const contentText = arrayValue(node.content)
    .map(plainTextFromAdf)
    .filter(Boolean)
    .join("\n");
  const separator = ["paragraph", "heading", "listItem"].includes(String(node.type))
    ? "\n"
    : "";

  return [ownText, contentText].filter(Boolean).join(separator);
}

function stripMarkdownMarker(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .trim();
}

function extractIssuesFromSearchResponse(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const value = response as Record<string, unknown>;
  const issues = value.issues;

  if (Array.isArray(issues)) {
    return issues;
  }

  if (issues && typeof issues === "object") {
    const issueCollection = issues as Record<string, unknown>;
    return arrayValue(
      issueCollection.nodes ?? issueCollection.values ?? issueCollection.results
    );
  }

  return arrayValue(value.nodes ?? value.values ?? value.results);
}

function assertAgentContext(context: JiraAgentContext): void {
  if (!context.selectedSpace.key || !context.selectedSpace.name) {
    throw new Error("Jira normalization requires the user-selected Jira space.");
  }

  if (
    !context.currentUser.accountId &&
    !context.currentUser.email &&
    !context.currentUser.displayName
  ) {
    throw new Error("Jira normalization requires the current Jira user from MCP.");
  }
}

function assertTicketWithinScope(
  ticket: NormalizedTicket,
  selectedSpace: JiraSpace
): void {
  if (!ticket.space?.key || ticket.space.key !== selectedSpace.key) {
    throw new Error(
      `Ticket ${ticket.key} is outside the selected Jira space. Expected ${selectedSpace.key}.`
    );
  }
}

function assertAssigneeMatchesCurrentUser(
  ticket: NormalizedTicket,
  currentUser: NormalizedUser
): void {
  if (!getAssigneeMatchMethod(ticket.assignee, currentUser)) {
    throw new Error(
      `Ticket assignee does not match current Jira user: ${ticket.key}. Checked accountId, email, then displayName.`
    );
  }
}

function createJiraMetadata(context: JiraAgentContext): JiraRunMetadata {
  return {
    cloudId: context.cloudId,
    siteUrl: context.siteUrl,
    jql: context.jql ?? buildAssignedJql(context.selectedSpace.key),
    selectedSpace: context.selectedSpace,
    grantedScopes: context.grantedScopes ?? [],
    readMode: "read-only",
    mutation: "disabled",
    tools: context.tools ?? [],
    searchTool: context.searchTool
  };
}

export function buildAssignedJql(spaceKey: string): string {
  return `project = "${spaceKey}" AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC`;
}

export function formatJiraSpaceList(spaces: JiraSpace[]): string {
  return spaces
    .map((space, index) => {
      const count =
        space.assignedTicketCount === undefined
          ? "unknown"
          : space.assignedTicketCount;
      return `${index + 1}. ${space.name}(${space.key}): ${count} tickets`;
    })
    .join("\n");
}

export function normalizeJiraSpace(raw: unknown): JiraSpace | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Record<string, unknown>;
  const key = stringValue(value.key);
  const name = stringValue(value.name);

  if (!key || !name) {
    return undefined;
  }

  return {
    id: stringValue(value.id),
    key,
    name
  };
}

export function normalizeVisibleJiraSpaces(
  response: unknown,
  assignedTicketCounts: Record<string, number> = {}
): JiraSpace[] {
  const values =
    response && typeof response === "object" && !Array.isArray(response)
      ? arrayValue((response as Record<string, unknown>).values)
      : arrayValue(response);

  return values
    .map(normalizeJiraSpace)
    .filter((space): space is JiraSpace => Boolean(space))
    .map((space) => ({
      ...space,
      assignedTicketCount: assignedTicketCounts[space.key]
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function matchJiraSpace(
  spaces: JiraSpace[],
  selector: string
): JiraSpace | undefined {
  const normalizedSelector = selector.trim().toLocaleLowerCase();
  const selectedIndex = /^\d+$/.test(normalizedSelector)
    ? Number.parseInt(normalizedSelector, 10)
    : Number.NaN;

  if (Number.isInteger(selectedIndex) && selectedIndex >= 1) {
    return spaces[selectedIndex - 1];
  }

  const selectedByKey = spaces.find(
    (space) => space.key.toLocaleLowerCase() === normalizedSelector
  );
  if (selectedByKey) {
    return selectedByKey;
  }

  const selectedByName = spaces.filter(
    (space) => space.name.trim().toLocaleLowerCase() === normalizedSelector
  );

  return selectedByName.length === 1 ? selectedByName[0] : undefined;
}

export function extractAcceptanceCriteria(description?: string): string[] {
  if (!description) {
    return [];
  }

  const lines = description.replace(/\r\n/g, "\n").split("\n");
  const candidates = acceptanceSectionNames.map((name) => name.toLowerCase());
  const collected: string[] = [];
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const normalized = stripMarkdownMarker(line).replace(/:$/, "").trim();
    const normalizedLower = normalized.toLowerCase();
    const headingMatch = /^#{1,6}\s+/.test(line) || /^\*\*.+\*\*$/.test(line);
    const candidateIndex = candidates.indexOf(normalizedLower);

    if (candidateIndex >= 0) {
      active = true;
      const inlineRemainder = line.split(":").slice(1).join(":").trim();
      if (inlineRemainder) {
        collected.push(stripMarkdownMarker(inlineRemainder));
      }
      continue;
    }

    if (active && headingMatch && line) {
      break;
    }

    if (active && line) {
      collected.push(stripMarkdownMarker(line));
    }
  }

  return collected.filter(Boolean);
}

export function normalizeJiraIssue(raw: unknown): NormalizedTicket {
  if (!raw || typeof raw !== "object") {
    throw new Error(
      "Jira response normalization failed: issue payload is not an object."
    );
  }

  const issue = raw as Record<string, unknown>;
  const fields = (issue.fields ?? {}) as Record<string, unknown>;
  const project = (fields.project ?? {}) as Record<string, unknown>;
  const issueType = (fields.issuetype ?? fields.issueType ?? {}) as Record<
    string,
    unknown
  >;
  const priority = (fields.priority ?? {}) as Record<string, unknown>;
  const status = (fields.status ?? {}) as Record<string, unknown>;
  const key = firstString(issue.key, fields.key);
  const title = firstString(fields.summary, issue.summary, issue.title);
  const description = plainTextFromAdf(fields.description ?? issue.description);

  if (!key || !title) {
    throw new Error(
      "Jira response normalization failed: key or summary is missing."
    );
  }

  return {
    key,
    title,
    workType:
      firstString(issueType.name, fields.issueType, issue.issueType) ?? "Unknown",
    priority: firstString(priority.name, fields.priority),
    status: firstString(status.name, fields.status),
    space: {
      key: firstString(project.key),
      name: firstString(project.name)
    },
    assignee: personFromJira(fields.assignee),
    reporter: personFromJira(fields.reporter),
    summary: title,
    description,
    acceptanceCriteria: extractAcceptanceCriteria(description),
    notes: [],
    comments: [],
    blockers: [],
    source: "jira"
  };
}

export function normalizeJiraAssignedTicketResponse(
  response: unknown,
  context: JiraAgentContext
): TicketCollection {
  assertAgentContext(context);
  const issues = extractIssuesFromSearchResponse(response);

  if (issues.length === 0) {
    throw new Error(
      `No assigned Jira tickets found in the selected space ${context.selectedSpace.key}.`
    );
  }

  const tickets = issues.map(normalizeJiraIssue);
  tickets.forEach((ticket) => {
    assertTicketWithinScope(ticket, context.selectedSpace);
    assertAssigneeMatchesCurrentUser(ticket, context.currentUser);
  });

  return {
    source: "jira",
    generatedAt: context.generatedAt ?? new Date().toISOString(),
    count: tickets.length,
    tickets,
    currentUser: context.currentUser,
    jira: createJiraMetadata(context)
  };
}

export function normalizeJiraTicketDetailResponse(
  response: unknown,
  context: JiraAgentContext
): TicketCollection {
  assertAgentContext(context);
  const ticket = normalizeJiraIssue(response);
  assertTicketWithinScope(ticket, context.selectedSpace);
  assertAssigneeMatchesCurrentUser(ticket, context.currentUser);

  return {
    source: "jira",
    generatedAt: context.generatedAt ?? new Date().toISOString(),
    count: 1,
    tickets: [ticket],
    currentUser: context.currentUser,
    jira: createJiraMetadata(context)
  };
}

function includesRiskTerm(ticket: NormalizedTicket): boolean {
  const haystack = [
    ticket.key,
    ticket.title,
    ticket.workType,
    ticket.summary,
    ticket.description,
    ticket.status,
    ticket.priority,
    ticket.space?.key,
    ticket.space?.name,
    ...(ticket.acceptanceCriteria ?? []),
    ...(ticket.notes ?? []),
    ...(ticket.blockers ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return riskyTerms.some((term) => haystack.includes(term));
}

function needsClarification(ticket: NormalizedTicket): string[] {
  const reasons: string[] = [];
  const haystack = [ticket.description, ...(ticket.notes ?? [])]
    .join(" ")
    .toLowerCase();

  if (ticket.acceptanceCriteria.length === 0) {
    reasons.push("Acceptance criteria are missing or could not be parsed.");
  }

  if (clarificationTerms.some((term) => haystack.includes(term))) {
    reasons.push("Ticket contains unclear or unconfirmed requirements.");
  }

  return reasons;
}

function modeFor(readiness: Readiness): {
  executionMode: ExecutionMode;
  verificationMode: VerificationMode;
} {
  return readiness === "ready"
    ? { executionMode: "plan-review", verificationMode: "light" }
    : { executionMode: "strict-review", verificationMode: "full" };
}

export function classifyTicket(ticket: NormalizedTicket): Classification {
  const reasons: string[] = [];
  let readiness: Readiness;

  if ((ticket.blockers ?? []).length > 0) {
    readiness = "blocked";
    reasons.push(`Blocked by: ${(ticket.blockers ?? []).join("; ")}`);
  } else if (includesRiskTerm(ticket)) {
    readiness = "risky";
    reasons.push("Risk-sensitive area detected.");
  } else {
    const clarificationReasons = needsClarification(ticket);
    if (clarificationReasons.length > 0) {
      readiness = "needs_clarification";
      reasons.push(...clarificationReasons);
    } else {
      readiness = "ready";
      reasons.push(
        "Requirements and acceptance criteria are clear enough to plan."
      );
    }
  }

  const modes = modeFor(readiness);

  return {
    key: ticket.key,
    title: ticket.title,
    space: ticket.space?.key ?? ticket.space?.name,
    assignee: ticket.assignee?.displayName ?? ticket.assignee?.accountId,
    readiness,
    ...modes,
    recommendedApprovalMode: modes.executionMode,
    recommendedVerificationMode: modes.verificationMode,
    reasons
  };
}

export function classifyTickets(
  tickets: NormalizedTicket[]
): Classification[] {
  return tickets.map(classifyTicket);
}

export function parseTicketKeyArg(args: string[]): string | undefined {
  const optionValueIndexes = new Set<number>();
  for (const option of ["--input", "--root", "--repo"]) {
    const optionIndex = args.indexOf(option);
    if (optionIndex >= 0) {
      optionValueIndexes.add(optionIndex + 1);
    }
  }

  return args.find((arg, index) => {
    if (arg === "--input" || arg === "--root" || arg === "--repo") {
      return false;
    }
    if (optionValueIndexes.has(index)) {
      return false;
    }
    return !arg.startsWith("--");
  });
}

export function parseInputPathArg(args: string[]): string {
  const inputIndex = args.indexOf("--input");
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1]?.trim() : undefined;

  if (!inputPath) {
    throw new Error(
      "Missing normalized ticket collection path after --input."
    );
  }

  return path.resolve(inputPath);
}

export function getAssigneeMatchMethod(
  assignee: NormalizedUser | undefined,
  currentUser: NormalizedUser
): "accountId" | "email" | "displayName" | undefined {
  if (!assignee) {
    return undefined;
  }

  if (
    assignee.accountId &&
    currentUser.accountId &&
    assignee.accountId === currentUser.accountId
  ) {
    return "accountId";
  }

  if (
    assignee.email &&
    currentUser.email &&
    normalizeEmail(assignee.email) === normalizeEmail(currentUser.email)
  ) {
    return "email";
  }

  if (
    assignee.displayName &&
    currentUser.displayName &&
    assignee.displayName === currentUser.displayName
  ) {
    return "displayName";
  }

  return undefined;
}

export function sanitizedTicket(ticket: NormalizedTicket): NormalizedTicket {
  if (ticket.source === "manual") {
    return {
      ...ticket,
      raw: undefined
    };
  }

  return {
    ...ticket,
    description: ticket.description
      ? "[redacted: Jira description is not persisted by default]"
      : undefined,
    comments:
      ticket.comments && ticket.comments.length > 0
        ? ["[redacted: Jira comments omitted]"]
        : [],
    raw: undefined
  };
}

export function sanitizedCollection(
  collection: TicketCollection
): TicketCollection {
  return {
    ...collection,
    tickets: collection.tickets.map(sanitizedTicket)
  };
}

export async function writeTicketCollectionRun(
  label: string,
  collection: TicketCollection
): Promise<string> {
  const runDir = await createAgentRunDir(label);
  const sanitized = sanitizedCollection(collection);
  await writeJsonFile(runDir, "assigned-ticket-list.json", sanitized);
  await writeTextFile(
    runDir,
    "agent-run-report.md",
    `# Agent Run Report

Ticket Source: ${collection.source}
Jira Read Mode: ${collection.source === "jira" ? "read-only" : "not used"}
Jira Mutation: ${collection.source === "jira" ? "disabled" : "not used"}
Jira Space: ${collection.tickets[0]?.space?.key ?? collection.tickets[0]?.space?.name ?? "unknown"}
Assignee: ${collection.tickets[0]?.assignee?.displayName ?? collection.tickets[0]?.assignee?.accountId ?? "unknown"}

## Scope

- JQL: ${collection.jira?.jql ?? "not used"}
- Search tool: ${collection.jira?.searchTool ?? "not used"}
`
  );

  return relativeToProject(runDir);
}

export async function writeTicketProcessingFailureRun(
  label: string,
  error: unknown
): Promise<string> {
  const runDir = await createAgentRunDir(`${label}-error`);
  const message = error instanceof Error ? error.message : String(error);

  await writeTextFile(
    runDir,
    "agent-run-report.md",
    `# Agent Run Report

Status: failed

## Error

${message}
`
  );

  return relativeToProject(runDir);
}
