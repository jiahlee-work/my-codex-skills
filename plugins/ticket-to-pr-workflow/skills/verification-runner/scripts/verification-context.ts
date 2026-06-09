import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extractMarkdownSection } from "../../../shared/core/markdown.js";
import { pathExists } from "../../../shared/core/fs.js";
import type {
  VerificationMode,
  VerificationModeDecision
} from "./verification.js";

export const verificationRequiredFiles = [
  "task-spec.md",
  "test-environment-report.md",
  "test-plan.md",
  "changed-files.json",
  "diff-summary.md",
  "implementation-summary.md",
  "code-review-report.md"
] as const;

type ChangedFile = {
  path: string;
  changeType?: string;
  reason?: string;
  additions?: number;
  deletions?: number;
};

type ChangedFilesArtifact = {
  ticketKey?: string;
  changedFiles: ChangedFile[];
};

export type VerificationInputs = {
  taskSpec: string;
  testEnvironmentReport: string;
  testPlan: string;
  changedFilesArtifact: ChangedFilesArtifact;
  diffSummary: string;
  implementationSummary: string;
  codeReviewReport: string;
  userImplementationIntent?: string;
  riskDetectionReport?: string;
  agentRunReport?: string;
};

export type VerificationContext = {
  runDir: string;
  ticketKey: string;
  inputs: VerificationInputs;
};

type VerificationSelection = {
  rootDir: string;
  runDir?: string;
};

async function missingFiles(runDir: string): Promise<string[]> {
  const checks = await Promise.all(
    verificationRequiredFiles.map(async (fileName) => ({
      fileName,
      exists: await pathExists(path.join(runDir, fileName))
    }))
  );
  return checks.filter((item) => !item.exists).map((item) => item.fileName);
}

async function readOptional(runDir: string, fileName: string): Promise<string | undefined> {
  const filePath = path.join(runDir, fileName);
  return (await pathExists(filePath)) ? readFile(filePath, "utf8") : undefined;
}

export async function resolveVerificationRunDir(
  selection: VerificationSelection
): Promise<string> {
  if (selection.runDir) {
    const explicitRunDir = path.resolve(selection.rootDir, selection.runDir);
    if (!(await pathExists(explicitRunDir))) {
      throw new Error(`Agent run directory not found: ${explicitRunDir}`);
    }
    const missing = await missingFiles(explicitRunDir);
    if (missing.length > 0) {
      throw new Error(
        `Local Verification cannot start. Missing required artifacts in ${explicitRunDir}: ${missing.join(", ")}`
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
      `No Local Verification-ready agent run found. Latest run ${sorted[0].runDir} is missing: ${sorted[0].missing.join(", ")}`
    );
  }
  throw new Error(`No agent run directories found under: ${runsRoot}`);
}

export async function readVerificationInputs(runDir: string): Promise<VerificationInputs> {
  const [
    taskSpec,
    testEnvironmentReport,
    testPlan,
    changedFilesJson,
    diffSummary,
    implementationSummary,
    codeReviewReport
  ] = await Promise.all(
    verificationRequiredFiles.map((fileName) => readFile(path.join(runDir, fileName), "utf8"))
  );
  let changedFilesArtifact: ChangedFilesArtifact;
  try {
    changedFilesArtifact = JSON.parse(changedFilesJson) as ChangedFilesArtifact;
  } catch {
    throw new Error(`Invalid JSON in ${path.join(runDir, "changed-files.json")}`);
  }
  if (!Array.isArray(changedFilesArtifact.changedFiles)) {
    throw new Error("changed-files.json must contain a changedFiles array.");
  }

  return {
    taskSpec,
    testEnvironmentReport,
    testPlan,
    changedFilesArtifact,
    diffSummary,
    implementationSummary,
    codeReviewReport,
    userImplementationIntent: await readOptional(
      runDir,
      "user-implementation-intent.md"
    ),
    riskDetectionReport: await readOptional(runDir, "risk-detection-report.md"),
    agentRunReport: await readOptional(runDir, "agent-run-report.md")
  };
}

function inferTicketKey(runDir: string, inputs: VerificationInputs): string {
  const fromArtifact = inputs.changedFilesArtifact.ticketKey;
  if (fromArtifact) {
    return fromArtifact;
  }
  const taskSpecTicket = extractMarkdownSection(inputs.taskSpec, "Ticket").match(
    /\b([A-Z][A-Z0-9]+-\d+)\b/
  )?.[1];
  const directoryTicket = path.basename(runDir).match(/^([A-Z][A-Z0-9]+-\d+)-/)?.[1];
  const ticketKey = taskSpecTicket ?? directoryTicket;
  if (!ticketKey) {
    throw new Error(`Could not infer ticket key from Local Verification agent run: ${runDir}`);
  }
  return ticketKey;
}

export async function loadVerificationContext(
  selection: VerificationSelection
): Promise<VerificationContext> {
  const runDir = await resolveVerificationRunDir(selection);
  const inputs = await readVerificationInputs(runDir);
  return {
    runDir,
    ticketKey: inferTicketKey(runDir, inputs),
    inputs
  };
}

function diffLineCount(inputs: VerificationInputs): number {
  const reported = inputs.diffSummary.match(/^- Diff line count:\s*(\d+)/m)?.[1];
  if (reported) {
    return Number(reported);
  }
  return inputs.changedFilesArtifact.changedFiles.reduce(
    (total, file) => total + (file.additions ?? 0) + (file.deletions ?? 0),
    0
  );
}

function hasRiskFindings(report?: string): boolean {
  if (!report) {
    return false;
  }
  const findings = extractMarkdownSection(report, "Findings");
  return Boolean(
    findings &&
      !/No risky changes were detected/i.test(findings) &&
      (findings.includes("### ") || /^[-*]\s+/m.test(findings))
  );
}

export function decideVerificationMode(
  context: VerificationContext,
  requestedMode?: VerificationMode
): VerificationModeDecision {
  const paths = context.inputs.changedFilesArtifact.changedFiles.map((file) => file.path);
  const scopeText = [
    context.inputs.taskSpec,
    context.inputs.implementationSummary,
    context.inputs.userImplementationIntent ?? ""
  ].join("\n");
  const riskSignals: string[] = [];

  if (
    paths.some((filePath) => /\.(tsx|jsx|vue|svelte)$/.test(filePath)) &&
    /\b(flow|form|screen|page|navigation|interaction|ui|ux|화면|흐름)\b/i.test(scopeText)
  ) {
    riskSignals.push("UI flow change detected.");
  }
  if (/\b(api|endpoint|fetch|request|response|integration|연동)\b/i.test(scopeText)) {
    riskSignals.push("API integration change detected.");
  }
  if (
    /\b(auth|authentication|authorization|permission|role|login|payment|billing|checkout|security|secret|token|인증|권한|결제|보안)\b/i.test(
      `${scopeText}\n${paths.join("\n")}`
    )
  ) {
    riskSignals.push("Authentication, authorization, payment, or security change detected.");
  }
  if (
    /\b(state management|redux|zustand|recoil|mobx|context provider|useReducer|store|상태 관리)\b/i.test(
      `${scopeText}\n${paths.join("\n")}`
    )
  ) {
    riskSignals.push("State management change detected.");
  }
  if (
    paths.some((filePath) =>
      /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(
        filePath
      )
    )
  ) {
    riskSignals.push("Package manifest or lockfile change detected.");
  }
  if (
    paths.some((filePath) =>
      /(^|\/)(?:tsconfig(?:\.[^/]+)?\.json|(?:vite|vitest|jest|playwright|webpack|rollup|next|babel|eslint)\.config\.[^/]+|setupTests\.[^/]+|test-setup\.[^/]+)$/.test(
        filePath
      )
    )
  ) {
    riskSignals.push("Test or build environment configuration change detected.");
  }
  const lines = diffLineCount(context.inputs);
  if (lines > 200) {
    riskSignals.push(`Diff line count ${lines} exceeds 200.`);
  }
  if (paths.length > 8) {
    riskSignals.push(`Changed file count ${paths.length} exceeds 8.`);
  }
  if (hasRiskFindings(context.inputs.riskDetectionReport)) {
    riskSignals.push("risk-detection-report.md contains findings.");
  }

  const recommendedMode: VerificationMode =
    riskSignals.length > 0 ? "full" : "light";
  const selectedMode = requestedMode ?? recommendedMode;
  const warnings =
    requestedMode === "light" && recommendedMode === "full"
      ? [
          "Light mode was explicitly selected even though full verification is recommended.",
          ...riskSignals
        ]
      : [];

  return {
    selectedMode,
    recommendedMode,
    source: requestedMode ? "user" : "automatic",
    riskSignals,
    warnings
  };
}
