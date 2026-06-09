import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../../../shared/core/fs.js";

export const browserRequiredFiles = [
  "task-spec.md",
  "test-plan.md",
  "changed-files.json",
  "implementation-summary.md",
  "verification-report.md"
] as const;

export const browserOptionalFiles = [
  "ticket-context-report.md",
  "user-implementation-intent.md",
  "storybook-report.md",
  "pr-plan.md",
  "agent-run-report.md"
] as const;

export type BrowserChangedFile = {
  path: string;
  changeType?: string;
  reason?: string;
  additions?: number;
  deletions?: number;
};

export type BrowserInputs = {
  taskSpec: string;
  testPlan: string;
  changedFilesArtifact: {
    ticketKey?: string;
    changedFiles: BrowserChangedFile[];
  };
  implementationSummary: string;
  verificationReport: string;
  ticketContextReport?: string;
  userImplementationIntent?: string;
  storybookReport?: string;
  prPlan?: string;
  agentRunReport?: string;
};

export type BrowserContext = {
  runDir: string;
  ticketKey: string;
  inputs: BrowserInputs;
};

type BrowserSelection = {
  rootDir: string;
  runDir?: string;
};

export async function missingBrowserFiles(runDir: string): Promise<string[]> {
  const checks = await Promise.all(
    browserRequiredFiles.map(async (fileName) => ({
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

export async function resolveBrowserRunDir(
  selection: BrowserSelection
): Promise<string> {
  if (selection.runDir) {
    const runDir = path.resolve(selection.rootDir, selection.runDir);
    if (!(await pathExists(runDir))) {
      throw new Error(`Agent run directory not found: ${runDir}`);
    }
    const missing = await missingBrowserFiles(runDir);
    if (missing.length > 0) {
      throw new Error(
        `Browser Scenario Verification cannot start. Missing required artifacts in ${runDir}: ${missing.join(", ")}`
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
          missing: await missingBrowserFiles(runDir),
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
      `No Browser Scenario Verification-ready agent run found. Latest run ${sorted[0].runDir} is missing: ${sorted[0].missing.join(", ")}`
    );
  }
  throw new Error(`No agent run directories found under: ${runsRoot}`);
}

export async function readBrowserInputs(runDir: string): Promise<BrowserInputs> {
  const [
    taskSpec,
    testPlan,
    changedFilesJson,
    implementationSummary,
    verificationReport
  ] = await Promise.all(
    browserRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );

  let changedFilesArtifact: BrowserInputs["changedFilesArtifact"];
  try {
    changedFilesArtifact = JSON.parse(
      changedFilesJson
    ) as BrowserInputs["changedFilesArtifact"];
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
    taskSpec,
    testPlan,
    changedFilesArtifact,
    implementationSummary,
    verificationReport,
    ticketContextReport: await readOptional(runDir, "ticket-context-report.md"),
    userImplementationIntent: await readOptional(
      runDir,
      "user-implementation-intent.md"
    ),
    storybookReport: await readOptional(runDir, "storybook-report.md"),
    prPlan: await readOptional(runDir, "pr-plan.md"),
    agentRunReport: await readOptional(runDir, "agent-run-report.md")
  };
}

function inferTicketKey(runDir: string, inputs: BrowserInputs): string {
  const fromArtifact = inputs.changedFilesArtifact.ticketKey;
  const fromReport = inputs.ticketContextReport?.match(
    /^## Ticket\s*\r?\n+\s*([A-Z][A-Z0-9]+-\d+)\b/m
  )?.[1];
  const fromDirectory = path.basename(runDir).match(
    /^([A-Z][A-Z0-9]+-\d+)-/
  )?.[1];
  const ticketKey = fromArtifact ?? fromReport ?? fromDirectory;
  if (!ticketKey) {
    throw new Error(`Could not infer ticket key from Browser Scenario Verification agent run: ${runDir}`);
  }
  return ticketKey;
}

export async function loadBrowserContext(
  selection: BrowserSelection
): Promise<BrowserContext> {
  const runDir = await resolveBrowserRunDir(selection);
  const inputs = await readBrowserInputs(runDir);
  return {
    runDir,
    ticketKey: inferTicketKey(runDir, inputs),
    inputs
  };
}
