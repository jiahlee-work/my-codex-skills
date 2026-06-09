import type { NormalizedTicket } from "../types/ticket.js";

export function markdownList(items?: string[]): string {
  return items && items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

export function escapeTableCell(value?: string): string {
  return (value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function extractMarkdownSection(markdown: string, sectionName: string): string {
  const lines = markdown.split(/\r?\n/);
  const collected: string[] = [];
  let active = false;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const heading = line.replace(/^##\s+/, "").trim();
      if (heading === sectionName) {
        active = true;
        continue;
      }
      if (active) {
        break;
      }
    }

    if (active) {
      collected.push(line);
    }
  }

  return collected.join("\n").trim();
}

export function displayTicketSpace(ticket: NormalizedTicket): string {
  return ticket.space?.key ?? ticket.space?.name ?? "unknown";
}

export function displayTicketAssignee(ticket: NormalizedTicket): string {
  return ticket.assignee?.displayName ?? ticket.assignee?.accountId ?? "unknown";
}
