import type { NormalizedTicket } from "../../../shared/types/ticket.js";
import {
  extractMarkdownSection,
  markdownList
} from "../../../shared/core/markdown.js";

export type BranchType = "feature" | "fix" | "chore";
export type CommitType = "feat" | "fix" | "test" | "refactor" | "chore" | "docs";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export const allowedCommitTypes: CommitType[] = [
  "feat",
  "fix",
  "test",
  "refactor",
  "chore",
  "docs"
];

export function extractPlannedBranch(branchPlan: string): string {
  const headings = ["Suggested Branch", "Proposed Branch", "Branch"];

  for (const heading of headings) {
    const section = extractMarkdownSection(branchPlan, heading);
    const fenced = section.match(/```(?:text)?\s*\r?\n([^\r\n]+)\r?\n```/i)?.[1];
    const inline = section.match(/`((?:feature|fix|chore)\/[^`\s]+)`/)?.[1];
    const plain = section.match(/\b((?:feature|fix|chore)\/[A-Za-z0-9._/-]+)\b/)?.[1];
    const branch = fenced?.trim() ?? inline ?? plain;
    if (branch) {
      return branch;
    }
  }

  throw new Error(
    "Could not find Suggested Branch, Proposed Branch, or Branch in branch-commit-plan.md."
  );
}

const fixTerms = [
  "bug",
  "error",
  "fail",
  "failure",
  "broken",
  "incorrect",
  "regression",
  "crash",
  "invalid"
];

const choreTerms = [
  "chore",
  "dependency",
  "dependencies",
  "config",
  "configuration",
  "fixture",
  "maintenance",
  "tooling"
];

function ticketText(ticket: NormalizedTicket): string {
  return [
    ticket.title,
    ticket.summary,
    ticket.description,
    ...(ticket.acceptanceCriteria ?? []),
    ...(ticket.notes ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug.length > 48 ? slug.slice(0, 48).replace(/-+$/g, "") : slug;
}

export function recommendBranchType(ticket: NormalizedTicket): BranchType {
  const text = ticketText(ticket);

  if (fixTerms.some((term) => text.includes(term))) {
    return "fix";
  }
  if (choreTerms.some((term) => text.includes(term))) {
    return "chore";
  }

  return "feature";
}

export function recommendCommitType(branchType: BranchType): CommitType {
  return branchType === "feature" ? "feat" : branchType;
}

export function validateBranchName(
  branchName: string,
  ticketKey: string
): ValidationResult {
  const errors: string[] = [];

  if (["main", "master", "develop"].includes(branchName)) {
    errors.push("Protected branch names are not allowed.");
  }

  const match = /^(feature|fix|chore)\/([A-Z][A-Z0-9]+-\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
    branchName
  );

  if (!match) {
    errors.push("Branch must match {type}/{ticketKey}-{slug}.");
  } else {
    const [, , actualTicketKey, slug] = match;
    if (actualTicketKey !== ticketKey) {
      errors.push(`Branch ticket key must be ${ticketKey}.`);
    }
    if (slug.length > 48) {
      errors.push("Branch slug must be 48 characters or less.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateCommitMessage(
  message: string,
  ticketKey: string
): ValidationResult {
  const errors: string[] = [];
  const normalized = message.replace(/\r\n/g, "\n").trim();
  const referencePattern = new RegExp(`(?:^|\\n|\\s)Refs:\\s*${ticketKey}(?:$|\\s)`);
  const subject = normalized.split("\n")[0]?.replace(/\s+Refs:\s+.+$/, "") ?? "";
  const subjectMatch = /^(feat|fix|test|refactor|chore|docs):\s+(.+)$/.exec(subject);

  if (!subjectMatch) {
    errors.push("First line must match {type}: {summary} without scope.");
  }

  if (!referencePattern.test(normalized)) {
    errors.push(`Commit message must include "Refs: ${ticketKey}".`);
  }

  return { valid: errors.length === 0, errors };
}

export function renderBranchCommitPlan(ticket: NormalizedTicket): string {
  const branchType = recommendBranchType(ticket);
  const branchName = `${branchType}/${ticket.key}-${slugify(ticket.title)}`;
  const commitType = recommendCommitType(branchType);
  const commitMessage = `${commitType}: ${slugify(ticket.title).replace(/-/g, " ")}\nRefs: ${ticket.key}`;
  const branchValidation = validateBranchName(branchName, ticket.key);
  const commitValidation = validateCommitMessage(commitMessage, ticket.key);

  return `# Branch And Commit Plan

## Proposed Branch

\`\`\`text
${branchName}
\`\`\`

- Validation: ${branchValidation.valid ? "pass" : "fail"}
${markdownList(branchValidation.errors)}

## Proposed Commit

\`\`\`text
${commitMessage}
\`\`\`

- Validation: ${commitValidation.valid ? "pass" : "fail"}
${markdownList(commitValidation.errors)}

## Commit Strategy

logical

## Policy Notes

- Branch type is inferred from the ticket content and expected change, not Jira work type.
- Branch format: \`{type}/{ticketKey}-{slug}\`
- Commit format: \`{type}: {summary}\` plus \`Refs: {ticketKey}\`
`;
}
