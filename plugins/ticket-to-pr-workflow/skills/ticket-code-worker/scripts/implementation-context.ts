import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  extractPlannedBranch,
  validateBranchName
} from "../../branch-commit-policy/scripts/branch-commit-policy.js";
import { pathExists, writeTextFile } from "../../../shared/core/fs.js";
import { extractMarkdownSection } from "../../../shared/core/markdown.js";

export const implementationRequiredFiles = [
  "ticket-context-report.md",
  "requirement-summary.md",
  "task-spec.md",
  "plan-critic-report.md",
  "branch-commit-plan.md",
  "test-environment-report.md",
  "test-plan.md"
] as const;

export type ImplementationInputs = {
  ticketContextReport: string;
  requirementSummary: string;
  taskSpec: string;
  planCriticReport: string;
  branchCommitPlan: string;
  testEnvironmentReport: string;
  testPlan: string;
  userImplementationIntent?: string;
  testSetupProposal?: string;
  agentRunReport?: string;
};

export type ImplementationContext = {
  runDir: string;
  ticketKey: string;
  branchName: string;
  intentSummary: string;
  inputs: ImplementationInputs;
  configChangeApproved: boolean;
};

type ImplementationSelection = {
  rootDir: string;
  ticketKey?: string;
  runDir?: string;
  intent?: string;
};

async function missingFiles(runDir: string): Promise<string[]> {
  const checks = await Promise.all(
    implementationRequiredFiles.map(async (fileName) => ({
      fileName,
      exists: await pathExists(path.join(runDir, fileName))
    }))
  );
  return checks.filter((item) => !item.exists).map((item) => item.fileName);
}

async function resolveExplicitRun(selection: ImplementationSelection): Promise<string> {
  const runDir = path.resolve(selection.rootDir, selection.runDir as string);
  const missing = await missingFiles(runDir);
  if (missing.includes("test-plan.md")) {
    throw new Error(
      `Implementation requires test-plan.md in ${runDir}. Run test-plan-worker first.`
    );
  }
  if (missing.length > 0) {
    throw new Error(`Agent run is missing Implementation inputs: ${missing.join(", ")}`);
  }
  return runDir;
}

export async function resolveImplementationRunDir(
  selection: ImplementationSelection
): Promise<string> {
  if (selection.runDir) {
    return resolveExplicitRun(selection);
  }

  const runsRoot = path.join(selection.rootDir, ".agent-runs");
  if (!(await pathExists(runsRoot))) {
    throw new Error(`Agent run directory not found: ${runsRoot}`);
  }

  const entries = await readdir(runsRoot, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          (!selection.ticketKey || entry.name.startsWith(`${selection.ticketKey}-`))
      )
      .map(async (entry) => {
        const runDir = path.join(runsRoot, entry.name);
        return {
          runDir,
          missing: await missingFiles(runDir),
          modifiedAt: (await stat(runDir)).mtimeMs
        };
      })
  );
  const complete = candidates
    .filter((candidate) => candidate.missing.length === 0)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];

  if (complete) {
    return complete.runDir;
  }

  const testPlanMissing = candidates.some((candidate) =>
    candidate.missing.includes("test-plan.md")
  );
  if (testPlanMissing) {
    const label = selection.ticketKey ? ` for ${selection.ticketKey}` : "";
    throw new Error(
      `No implementation-ready agent run found${label}. Run test-plan-worker first.`
    );
  }

  throw new Error(
    "No agent run with complete planning and test-planning artifacts was found."
  );
}

async function readOptional(runDir: string, fileName: string): Promise<string | undefined> {
  const filePath = path.join(runDir, fileName);
  return (await pathExists(filePath)) ? readFile(filePath, "utf8") : undefined;
}

export async function readImplementationInputs(runDir: string): Promise<ImplementationInputs> {
  const [
    ticketContextReport,
    requirementSummary,
    taskSpec,
    planCriticReport,
    branchCommitPlan,
    testEnvironmentReport,
    testPlan
  ] = await Promise.all(
    implementationRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );

  return {
    ticketContextReport,
    requirementSummary,
    taskSpec,
    planCriticReport,
    branchCommitPlan,
    testEnvironmentReport,
    testPlan,
    userImplementationIntent: await readOptional(
      runDir,
      "user-implementation-intent.md"
    ),
    testSetupProposal: await readOptional(runDir, "test-setup-proposal.md"),
    agentRunReport: await readOptional(runDir, "agent-run-report.md")
  };
}

export function inferImplementationTicketKey(inputs: ImplementationInputs, runDir: string): string {
  const reportMatch = inputs.ticketContextReport.match(
    /^## Ticket\s*\r?\n+\s*([A-Z][A-Z0-9]+-\d+)\b/m
  );
  const directoryMatch = path.basename(runDir).match(/^([A-Z][A-Z0-9]+-\d+)-/);
  const ticketKey = reportMatch?.[1] ?? directoryMatch?.[1];

  if (!ticketKey) {
    throw new Error(`Could not infer ticket key from agent run: ${runDir}`);
  }
  return ticketKey;
}

async function ensureIntent(
  runDir: string,
  inputs: ImplementationInputs,
  currentIntent?: string
): Promise<string> {
  if (inputs.userImplementationIntent?.trim()) {
    return (
      extractMarkdownSection(inputs.userImplementationIntent, "Summary") ||
      inputs.userImplementationIntent.trim()
    );
  }

  const summary = currentIntent?.trim();
  if (!summary) {
    throw new Error(
      "user-implementation-intent.md is missing. Summarize the current conversation and pass it with --intent before implementation."
    );
  }
  await writeTextFile(
    runDir,
    "user-implementation-intent.md",
    `# User Implementation Intent

## Source

Current conversation

## Summary

${summary}
`
  );
  return summary;
}

function testSetupApproval(inputs: ImplementationInputs): boolean {
  const reportApproval = inputs.agentRunReport?.match(
    /^- Approved test stack:\s*(.+)$/m
  )?.[1];
  const proposalApproval = inputs.testSetupProposal?.match(
    /^Approved stack:\s*(.+)$/m
  )?.[1];
  return [reportApproval, proposalApproval].some(
    (value) => Boolean(value && value.trim().toLowerCase() !== "not approved")
  );
}

export async function loadImplementationContext(
  selection: ImplementationSelection
): Promise<ImplementationContext> {
  const runDir = await resolveImplementationRunDir(selection);
  const initialInputs = await readImplementationInputs(runDir);
  const ticketKey = selection.ticketKey ?? inferImplementationTicketKey(initialInputs, runDir);
  const branchName = extractPlannedBranch(initialInputs.branchCommitPlan);
  const validation = validateBranchName(branchName, ticketKey);

  if (!validation.valid) {
    throw new Error(
      `Planned branch does not satisfy branch-commit-policy: ${validation.errors.join(" ")}`
    );
  }

  const intentSummary = await ensureIntent(runDir, initialInputs, selection.intent);
  const inputs = initialInputs.userImplementationIntent
    ? initialInputs
    : await readImplementationInputs(runDir);

  return {
    runDir,
    ticketKey,
    branchName,
    intentSummary,
    inputs,
    configChangeApproved: testSetupApproval(inputs)
  };
}
