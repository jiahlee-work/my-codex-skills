import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../../../shared/core/fs.js";

export const storybookRequiredFiles = [
  "changed-files.json",
  "diff-summary.md",
  "implementation-summary.md",
  "code-review-report.md",
  "verification-report.md"
] as const;

export const storybookOptionalFiles = [
  "ticket-context-report.md",
  "task-spec.md",
  "test-plan.md",
  "user-implementation-intent.md",
  "commit-plan.md",
  "pr-description.md",
  "pr-plan.md",
  "agent-run-report.md"
] as const;

export type StorybookChangedFile = {
  path: string;
  changeType?: string;
  reason?: string;
  additions?: number;
  deletions?: number;
};

export type StorybookInputs = {
  changedFilesArtifact: {
    ticketKey?: string;
    changedFiles: StorybookChangedFile[];
  };
  diffSummary: string;
  implementationSummary: string;
  codeReviewReport: string;
  verificationReport: string;
  ticketContextReport?: string;
  taskSpec?: string;
  testPlan?: string;
  userImplementationIntent?: string;
  commitPlan?: string;
  prDescription?: string;
  prPlan?: string;
  agentRunReport?: string;
};

export type StorybookContext = {
  runDir: string;
  ticketKey: string;
  inputs: StorybookInputs;
};

type StorybookSelection = {
  rootDir: string;
  runDir?: string;
};

export async function missingStorybookFiles(runDir: string): Promise<string[]> {
  const checks = await Promise.all(
    storybookRequiredFiles.map(async (fileName) => ({
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

export async function resolveStorybookRunDir(
  selection: StorybookSelection
): Promise<string> {
  if (selection.runDir) {
    const runDir = path.resolve(selection.rootDir, selection.runDir);
    if (!(await pathExists(runDir))) {
      throw new Error(`Agent run directory not found: ${runDir}`);
    }
    const missing = await missingStorybookFiles(runDir);
    if (missing.length > 0) {
      throw new Error(
        `Storybook Verification cannot start. Missing required artifacts in ${runDir}: ${missing.join(", ")}`
      );
    }
    return runDir;
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
          missing: await missingStorybookFiles(runDir),
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
      `No Storybook Verification-ready agent run found. Latest run ${sorted[0].runDir} is missing: ${sorted[0].missing.join(", ")}`
    );
  }
  throw new Error(`No agent run directories found under: ${runsRoot}`);
}

export async function readStorybookInputs(runDir: string): Promise<StorybookInputs> {
  const [
    changedFilesJson,
    diffSummary,
    implementationSummary,
    codeReviewReport,
    verificationReport
  ] = await Promise.all(
    storybookRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );
  let changedFilesArtifact: StorybookInputs["changedFilesArtifact"];
  try {
    changedFilesArtifact = JSON.parse(
      changedFilesJson
    ) as StorybookInputs["changedFilesArtifact"];
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

  const optionalValues = await Promise.all(
    storybookOptionalFiles.map((fileName) => readOptional(runDir, fileName))
  );
  const optional = Object.fromEntries(
    storybookOptionalFiles.map((fileName, index) => [fileName, optionalValues[index]])
  );

  return {
    changedFilesArtifact,
    diffSummary,
    implementationSummary,
    codeReviewReport,
    verificationReport,
    ticketContextReport: optional["ticket-context-report.md"],
    taskSpec: optional["task-spec.md"],
    testPlan: optional["test-plan.md"],
    userImplementationIntent: optional["user-implementation-intent.md"],
    commitPlan: optional["commit-plan.md"],
    prDescription: optional["pr-description.md"],
    prPlan: optional["pr-plan.md"],
    agentRunReport: optional["agent-run-report.md"]
  };
}

function inferTicketKey(runDir: string, inputs: StorybookInputs): string {
  const fromArtifact = inputs.changedFilesArtifact.ticketKey;
  const fromReport = inputs.ticketContextReport?.match(
    /^## Ticket\s*\r?\n+\s*([A-Z][A-Z0-9]+-\d+)\b/m
  )?.[1];
  const fromDirectory = path.basename(runDir).match(
    /^([A-Z][A-Z0-9]+-\d+)-/
  )?.[1];
  const ticketKey = fromArtifact ?? fromReport ?? fromDirectory;
  if (!ticketKey) {
    throw new Error(`Could not infer ticket key from Storybook Verification agent run: ${runDir}`);
  }
  return ticketKey;
}

export async function loadStorybookContext(
  selection: StorybookSelection
): Promise<StorybookContext> {
  const runDir = await resolveStorybookRunDir(selection);
  const inputs = await readStorybookInputs(runDir);
  return {
    runDir,
    ticketKey: inferTicketKey(runDir, inputs),
    inputs
  };
}
