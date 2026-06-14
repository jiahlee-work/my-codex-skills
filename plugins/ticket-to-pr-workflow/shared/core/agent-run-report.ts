import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs.js";

export const agentRunReportFileName = "agent-run-report.md";

export function replaceAgentRunReportSection(
  markdown: string,
  heading: string,
  body: string,
  aliases: string[] = []
): string {
  const normalized = markdown.trimEnd() || "# Agent Run Report";
  const lines = normalized.split(/\r?\n/);
  const headings = [heading, ...aliases].map((item) => `## ${item}`);
  const start = lines.findIndex((line) => headings.includes(line.trim()));

  if (start === -1) {
    return `${normalized}\n\n## ${heading}\n\n${body.trim()}\n`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }

  return [
    ...lines.slice(0, start),
    `## ${heading}`,
    "",
    body.trim(),
    ...lines.slice(end)
  ].join("\n").trimEnd() + "\n";
}

export async function readAgentRunReport(runDir: string): Promise<string> {
  const reportPath = path.join(runDir, agentRunReportFileName);
  return (await pathExists(reportPath))
    ? readFile(reportPath, "utf8")
    : "# Agent Run Report\n";
}

export async function updateAgentRunReportSection(
  runDir: string,
  heading: string,
  body: string,
  aliases: string[] = []
): Promise<string> {
  const updated = replaceAgentRunReportSection(
    await readAgentRunReport(runDir),
    heading,
    body,
    aliases
  );
  await writeFile(path.join(runDir, agentRunReportFileName), updated, "utf8");
  return updated;
}
