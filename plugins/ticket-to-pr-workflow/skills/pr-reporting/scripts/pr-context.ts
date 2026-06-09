import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extractPlannedBranch } from "../../branch-commit-policy/scripts/branch-commit-policy.js";
import { extractMarkdownSection } from "../../../shared/core/markdown.js";
import { pathExists } from "../../../shared/core/fs.js";

export const prReportingRequiredFiles = [
  "branch-commit-plan.md",
  "changed-files.json",
  "diff-summary.md",
  "implementation-summary.md",
  "code-review-report.md",
  "verification-report.md"
] as const;

export type CommitStrategy = "logical" | "squash" | "step-based";

export type PrChangedFile = {
  path: string;
  changeType?: string;
  reason?: string;
};

export type PrReportingInputs = {
  branchCommitPlan: string;
  changedFilesArtifact: {
    ticketKey?: string;
    changedFiles: PrChangedFile[];
  };
  diffSummary: string;
  implementationSummary: string;
  codeReviewReport: string;
  verificationReport: string;
  ticketContextReport?: string;
  requirementSummary?: string;
  taskSpec?: string;
  planCriticReport?: string;
  userImplementationIntent?: string;
  riskDetectionReport?: string;
  failureReport?: string;
  agentRunReport?: string;
};

export type PrReportingContext = {
  runDir: string;
  ticketKey: string;
  branchName: string;
  verificationResult: string;
  inputs: PrReportingInputs;
};

type PrReportingSelection = {
  rootDir: string;
  runDir?: string;
};

async function missingFiles(runDir: string): Promise<string[]> {
  const checks = await Promise.all(
    prReportingRequiredFiles.map(async (fileName) => ({
      fileName,
      exists: await pathExists(path.join(runDir, fileName))
    }))
  );
  return checks.filter((item) => !item.exists).map((item) => item.fileName);
}

async function readOptional(
  runDir: string,
  fileName: string
): Promise<string | undefined> {
  const filePath = path.join(runDir, fileName);
  return (await pathExists(filePath)) ? readFile(filePath, "utf8") : undefined;
}

export async function resolvePrReportingRunDir(
  selection: PrReportingSelection
): Promise<string> {
  if (selection.runDir) {
    const explicitRunDir = path.resolve(selection.rootDir, selection.runDir);
    if (!(await pathExists(explicitRunDir))) {
      throw new Error(`Agent run directory not found: ${explicitRunDir}`);
    }
    const missing = await missingFiles(explicitRunDir);
    if (missing.length > 0) {
      throw new Error(
        `PR Reporting cannot start. Missing required artifacts in ${explicitRunDir}: ${missing.join(", ")}`
      );
    }
    return explicitRunDir;
  }

  const runsRoot = path.join(selection.rootDir, ".agent-runs");
  if (!(await pathExists(runsRoot))) {
    throw new Error(`Agent run directory not found: ${runsRoot}`);
  }
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const runDir = path.join(runsRoot, entry.name);
        return {
          runDir,
          missing: await missingFiles(runDir),
          modifiedAt: (await stat(runDir)).mtimeMs
        };
      })
  );
  const sorted = candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  const complete = sorted.find((candidate) => candidate.missing.length === 0);
  if (complete) {
    return complete.runDir;
  }
  if (sorted[0]) {
    throw new Error(
      `No PR Reporting-ready agent run found. Latest run ${sorted[0].runDir} is missing: ${sorted[0].missing.join(", ")}`
    );
  }
  throw new Error(`No agent run directories found under: ${runsRoot}`);
}

export async function readPrReportingInputs(runDir: string): Promise<PrReportingInputs> {
  const [
    branchCommitPlan,
    changedFilesJson,
    diffSummary,
    implementationSummary,
    codeReviewReport,
    verificationReport
  ] = await Promise.all(
    prReportingRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );
  let changedFilesArtifact: PrReportingInputs["changedFilesArtifact"];
  try {
    changedFilesArtifact = JSON.parse(changedFilesJson) as PrReportingInputs["changedFilesArtifact"];
  } catch {
    throw new Error(`Invalid JSON in ${path.join(runDir, "changed-files.json")}`);
  }
  if (!Array.isArray(changedFilesArtifact.changedFiles)) {
    throw new Error("changed-files.json must contain a changedFiles array.");
  }
  for (const changedFile of changedFilesArtifact.changedFiles) {
    if (!changedFile || typeof changedFile.path !== "string" || !changedFile.path.trim()) {
      throw new Error("Every changed-files.json entry must contain a non-empty path.");
    }
  }

  return {
    branchCommitPlan,
    changedFilesArtifact,
    diffSummary,
    implementationSummary,
    codeReviewReport,
    verificationReport,
    ticketContextReport: await readOptional(runDir, "ticket-context-report.md"),
    requirementSummary: await readOptional(runDir, "requirement-summary.md"),
    taskSpec: await readOptional(runDir, "task-spec.md"),
    planCriticReport: await readOptional(runDir, "plan-critic-report.md"),
    userImplementationIntent: await readOptional(
      runDir,
      "user-implementation-intent.md"
    ),
    riskDetectionReport: await readOptional(runDir, "risk-detection-report.md"),
    failureReport: await readOptional(runDir, "failure-report.md"),
    agentRunReport: await readOptional(runDir, "agent-run-report.md")
  };
}

function inferTicketKey(runDir: string, inputs: PrReportingInputs): string {
  const fromArtifact = inputs.changedFilesArtifact.ticketKey;
  const fromReport = inputs.ticketContextReport
    ?.match(/^## Ticket\s*\r?\n+\s*([A-Z][A-Z0-9]+-\d+)\b/m)?.[1];
  const fromDirectory = path.basename(runDir).match(/^([A-Z][A-Z0-9]+-\d+)-/)?.[1];
  const ticketKey = fromArtifact ?? fromReport ?? fromDirectory;
  if (!ticketKey) {
    throw new Error(`Could not infer ticket key from PR Reporting agent run: ${runDir}`);
  }
  return ticketKey;
}

export function verificationResult(report: string): string {
  return extractMarkdownSection(report, "Result")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.toLowerCase() ?? "unknown";
}

export function strategyFromBranchPlan(branchPlan: string): CommitStrategy {
  for (const heading of ["Commit Strategy", "Strategy"]) {
    const section = extractMarkdownSection(branchPlan, heading);
    const match = section.match(/\b(logical|squash|step-based)\b/i)?.[1];
    if (match) {
      return match.toLowerCase() as CommitStrategy;
    }
  }
  return "logical";
}

export async function loadPrReportingContext(
  selection: PrReportingSelection
): Promise<PrReportingContext> {
  const runDir = await resolvePrReportingRunDir(selection);
  const inputs = await readPrReportingInputs(runDir);
  return {
    runDir,
    ticketKey: inferTicketKey(runDir, inputs),
    branchName: extractPlannedBranch(inputs.branchCommitPlan),
    verificationResult: verificationResult(inputs.verificationReport),
    inputs
  };
}
