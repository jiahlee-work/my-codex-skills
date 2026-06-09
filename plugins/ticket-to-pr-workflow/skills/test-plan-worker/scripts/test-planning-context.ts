import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../../../shared/core/fs.js";

export const testPlanningRequiredFiles = [
  "ticket-context-report.md",
  "requirement-summary.md",
  "task-spec.md",
  "plan-critic-report.md",
  "branch-commit-plan.md"
] as const;

export type TestPlanningInputs = {
  ticketContextReport: string;
  requirementSummary: string;
  taskSpec: string;
  planCriticReport: string;
  branchCommitPlan: string;
  userImplementationIntent?: string;
};

type TestPlanningSelection = {
  rootDir: string;
  ticketKey?: string;
  runDir?: string;
};

async function hasRequiredFiles(runDir: string): Promise<boolean> {
  const results = await Promise.all(
    testPlanningRequiredFiles.map((fileName) => pathExists(path.join(runDir, fileName)))
  );
  return results.every(Boolean);
}

export async function resolveTestPlanningRunDir(selection: TestPlanningSelection): Promise<string> {
  if (selection.runDir) {
    const explicitRunDir = path.resolve(selection.rootDir, selection.runDir);
    if (!(await hasRequiredFiles(explicitRunDir))) {
      throw new Error(
        `Agent run is missing required Test Planning inputs: ${explicitRunDir}`
      );
    }
    return explicitRunDir;
  }

  const agentRunsDir = path.join(selection.rootDir, ".agent-runs");
  if (!(await pathExists(agentRunsDir))) {
    throw new Error(`Agent run directory not found: ${agentRunsDir}`);
  }

  const entries = await readdir(agentRunsDir, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          (!selection.ticketKey || entry.name.startsWith(`${selection.ticketKey}-`))
      )
      .map(async (entry) => {
        const runDir = path.join(agentRunsDir, entry.name);
        const timestamp = entry.name.match(
          /-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/
        )?.[1];
        return {
          runDir,
          valid: await hasRequiredFiles(runDir),
          timestamp,
          modifiedAt: (await stat(runDir)).mtimeMs
        };
      })
  );

  const selected = candidates
    .filter((candidate) => candidate.valid)
    .sort((left, right) => {
      if (left.timestamp && right.timestamp) {
        return right.timestamp.localeCompare(left.timestamp);
      }
      return right.modifiedAt - left.modifiedAt;
    })[0];

  if (!selected) {
    const label = selection.ticketKey ? ` for ${selection.ticketKey}` : "";
    throw new Error(`No complete Planning agent run found${label}.`);
  }

  return selected.runDir;
}

export async function readTestPlanningInputs(runDir: string): Promise<TestPlanningInputs> {
  const [
    ticketContextReport,
    requirementSummary,
    taskSpec,
    planCriticReport,
    branchCommitPlan
  ] = await Promise.all(
    testPlanningRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );
  const intentPath = path.join(runDir, "user-implementation-intent.md");

  return {
    ticketContextReport,
    requirementSummary,
    taskSpec,
    planCriticReport,
    branchCommitPlan,
    userImplementationIntent: (await pathExists(intentPath))
      ? await readFile(intentPath, "utf8")
      : undefined
  };
}

export function inferTicketKey(inputs: TestPlanningInputs, runDir: string): string {
  const reportMatch = inputs.ticketContextReport.match(
    /^## Ticket\s*\r?\n+\s*([A-Z][A-Z0-9]+-\d+)\b/m
  );
  if (reportMatch?.[1]) {
    return reportMatch[1];
  }

  const directoryMatch = path.basename(runDir).match(/^([A-Z][A-Z0-9]+-\d+)-/);
  if (directoryMatch?.[1]) {
    return directoryMatch[1];
  }

  throw new Error(`Could not infer ticket key from agent run: ${runDir}`);
}

function replaceMarkdownSection(markdown: string, heading: string, body: string): string {
  const lines = markdown.trimEnd().split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === headingLine);

  if (start === -1) {
    return `${markdown.trimEnd()}\n\n${headingLine}\n\n${body.trim()}\n`;
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
    headingLine,
    "",
    body.trim(),
    ...lines.slice(end)
  ].join("\n").trimEnd() + "\n";
}

export type TestPlanningReportUpdate = {
  status: "environment-detected" | "approval-required" | "test-plan-created";
  repository: string;
  generatedFiles: string[];
  missingSetup: string[];
  approvedStack?: string;
};

export async function updateTestPlanningAgentRunReport(
  runDir: string,
  update: TestPlanningReportUpdate
): Promise<void> {
  const reportPath = path.join(runDir, "agent-run-report.md");
  const existing = (await pathExists(reportPath))
    ? await readFile(reportPath, "utf8")
    : "# Agent Run Report\n";
  const artifactOrder = [
    "user-implementation-intent.md",
    "test-environment-report.md",
    "test-setup-proposal.md",
    "test-plan.md"
  ];
  const existingArtifacts = (
    await Promise.all(
      artifactOrder.map(async (fileName) => ({
        fileName,
        exists: await pathExists(path.join(runDir, fileName))
      }))
    )
  ).filter((item) => item.exists).map((item) => item.fileName);
  const generatedFiles = artifactOrder.filter(
    (fileName) =>
      existingArtifacts.includes(fileName) || update.generatedFiles.includes(fileName)
  );
  const existingApprovedStack = existing.match(/^- Approved test stack: (.+)$/m)?.[1];
  const approvedStack =
    update.approvedStack ??
    (existingApprovedStack && existingApprovedStack !== "not approved"
      ? existingApprovedStack
      : undefined);
  const status = existingArtifacts.includes("test-plan.md")
    ? "test-plan-created"
    : update.status;
  const list = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None";
  const body = `- Status: ${status}
- Updated at: ${new Date().toISOString()}
- Repository: ${update.repository}
- Approved test stack: ${approvedStack ?? "not approved"}

### Generated Artifacts

${list(generatedFiles)}

### Missing Test Setup

${list(update.missingSetup)}

### Test Planning Boundary

- Do not implement product code or test code.
- Do not install dependencies or modify package, lock, config, or setup files without explicit approval.
- Do not run full lint, typecheck, build, test, or Playwright verification as part of the Test Planning workflow.
- Do not create branches, commits, pushes, PRs, deployments, or Jira mutations.`;

  await writeFile(
    reportPath,
    replaceMarkdownSection(existing, "Test Planning", body),
    "utf8"
  );
}
