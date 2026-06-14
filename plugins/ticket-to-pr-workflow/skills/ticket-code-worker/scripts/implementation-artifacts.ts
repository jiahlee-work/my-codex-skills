import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import { extractMarkdownSection, markdownList } from "../../../shared/core/markdown.js";
import { pathExists, writeJsonFile, writeTextFile } from "../../../shared/core/fs.js";
import { isProtectedBranch, parsePorcelainStatus, runGit } from "../../../shared/core/git-worktree.js";
import type { ImplementationContext } from "./implementation-context.js";

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export type ChangedFile = {
  path: string;
  changeType: ChangeType;
  reason: string;
  additions: number;
  deletions: number;
  binary: boolean;
  originalPath?: string;
};

export type DiffCollection = {
  ticketKey: string;
  branchName: string;
  changedFiles: ChangedFile[];
  additions: number;
  deletions: number;
  diffLineCount: number;
  gitDiffStat: string;
  gitDiffNameOnly: string[];
  fullDiffCollected: boolean;
  diffContent: string;
};

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RiskFinding = {
  id: string;
  severity: RiskSeverity;
  category: string;
  message: string;
  paths: string[];
  requiresStop: boolean;
};

export type RiskDetection = {
  ticketKey: string;
  branchName: string;
  approvedConfigChanges: boolean;
  findings: RiskFinding[];
  shouldStop: boolean;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillResources = path.resolve(
  scriptDir,
  "../resources"
);

function isAgentRunPath(filePath: string): boolean {
  return filePath === ".agent-runs" || filePath.startsWith(".agent-runs/");
}

function changeTypeFor(code: string): ChangeType {
  if (code === "??" || code.includes("A")) {
    return "added";
  }
  if (code.includes("D")) {
    return "deleted";
  }
  if (code.includes("R")) {
    return "renamed";
  }
  return "modified";
}

function defaultReason(filePath: string, changeType: ChangeType): string {
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath) || /(^|\/)(__tests__|tests)\//.test(filePath)) {
    return `${changeType === "added" ? "Add" : "Update"} focused test coverage for the ticket Test Plan.`;
  }
  if (/package\.json$|(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(filePath)) {
    return "Update project or dependency metadata under explicit setup approval.";
  }
  return `${changeType === "added" ? "Add" : "Update"} ticket-scoped implementation code.`;
}

function parseNumstat(output: string): Map<string, {
  additions: number;
  deletions: number;
  binary: boolean;
}> {
  const values = new Map<string, { additions: number; deletions: number; binary: boolean }>();
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    const [added, deleted, ...pathParts] = line.split("\t");
    const filePath = pathParts.join("\t");
    const binary = added === "-" || deleted === "-";
    values.set(filePath, {
      additions: binary ? 0 : Number(added),
      deletions: binary ? 0 : Number(deleted),
      binary
    });
  }
  return values;
}

async function untrackedStats(
  repository: string,
  filePath: string
): Promise<{ additions: number; deletions: number; binary: boolean }> {
  const absolutePath = path.join(repository, filePath);
  const fileStat = await stat(absolutePath).catch(() => undefined);
  if (!fileStat?.isFile()) {
    return { additions: 0, deletions: 0, binary: false };
  }
  const content = await readFile(absolutePath);
  const binary = content.includes(0);
  if (binary) {
    return { additions: 0, deletions: 0, binary: true };
  }
  const text = content.toString("utf8");
  const lines = text.split(/\r?\n/);
  return {
    additions:
      text.length === 0 ? 0 : lines.length - (/\r?\n$/.test(text) ? 1 : 0),
    deletions: 0,
    binary: false
  };
}

export async function collectWorkingTreeDiff(options: {
  repository: string;
  ticketKey: string;
  reasons?: Record<string, string>;
}): Promise<DiffCollection> {
  const repositoryCheck = await runGit(
    options.repository,
    ["rev-parse", "--is-inside-work-tree"],
    true
  );
  if (repositoryCheck.exitCode !== 0 || repositoryCheck.stdout.trim() !== "true") {
    throw new Error(`Not a Git worktree: ${options.repository}`);
  }
  const branchName = (
    await runGit(options.repository, ["branch", "--show-current"])
  ).stdout.trim();
  const statusOutput = (
    await runGit(options.repository, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all"
    ])
  ).stdout;
  const statusEntries = parsePorcelainStatus(statusOutput).filter(
    (entry) => !isAgentRunPath(entry.path)
  );
  const pathspec = ["--", ".", ":(exclude).agent-runs/**"];
  const [statResult, nameOnlyResult, diffResult, numstatResult] = await Promise.all([
    runGit(options.repository, ["diff", "HEAD", "--stat", ...pathspec]),
    runGit(options.repository, ["diff", "HEAD", "--name-only", ...pathspec]),
    runGit(options.repository, ["diff", "HEAD", ...pathspec]),
    runGit(options.repository, ["diff", "HEAD", "--numstat", ...pathspec])
  ]);
  const numstat = parseNumstat(numstatResult.stdout);
  const changedFiles = await Promise.all(
    statusEntries.map(async (entry) => {
      const changeType = changeTypeFor(entry.code);
      const trackedStats =
        numstat.get(entry.path) ??
        (entry.originalPath ? numstat.get(entry.originalPath) : undefined);
      const lineStats =
        trackedStats ??
        (entry.code === "??"
          ? await untrackedStats(options.repository, entry.path)
          : { additions: 0, deletions: 0, binary: false });

      return {
        path: entry.path,
        changeType,
        reason:
          options.reasons?.[entry.path] ?? defaultReason(entry.path, changeType),
        ...lineStats,
        ...(entry.originalPath ? { originalPath: entry.originalPath } : {})
      };
    })
  );
  const additions = changedFiles.reduce((total, file) => total + file.additions, 0);
  const deletions = changedFiles.reduce((total, file) => total + file.deletions, 0);
  const trackedNames = nameOnlyResult.stdout.split(/\r?\n/).filter(Boolean);

  return {
    ticketKey: options.ticketKey,
    branchName,
    changedFiles,
    additions,
    deletions,
    diffLineCount: additions + deletions,
    gitDiffStat: statResult.stdout.trim(),
    gitDiffNameOnly: [...new Set([...trackedNames, ...changedFiles.map((file) => file.path)])],
    fullDiffCollected: diffResult.exitCode === 0,
    diffContent: diffResult.stdout
  };
}

function renderDiffSummary(diff: DiffCollection): string {
  const rows = diff.changedFiles.length > 0
    ? diff.changedFiles
        .map(
          (file) =>
            `| \`${file.path}\` | ${file.changeType} | +${file.additions} / -${file.deletions}${file.binary ? " / binary" : ""} | ${file.reason.replace(/\|/g, "\\|")} |`
        )
        .join("\n")
    : "| None | None | +0 / -0 | No code changes detected. |";

  return `# Diff Summary

## Ticket

${diff.ticketKey}

## Branch

${diff.branchName || "detached"}

## Totals

- Changed files: ${diff.changedFiles.length}
- Additions: ${diff.additions}
- Deletions: ${diff.deletions}
- Diff line count: ${diff.diffLineCount}

## Git Diff Stat

\`\`\`text
${diff.gitDiffStat || "No tracked diff."}
\`\`\`

## Changed Files

| Path | Change Type | Lines | Reason |
| --- | --- | --- | --- |
${rows}

## Collection Notes

- \`git diff --stat\`, \`git diff --name-only\`, and \`git diff\` were collected.
- Untracked files from \`git status\` were included in the metadata.
- The full diff is intentionally omitted from this report.
- \`.agent-runs/\` artifacts are excluded from code-change analysis.
`;
}

export async function writeDiffArtifacts(
  runDir: string,
  diff: DiffCollection
): Promise<void> {
  await Promise.all([
    writeTextFile(runDir, "diff-summary.md", renderDiffSummary(diff)),
    writeJsonFile(runDir, "changed-files.json", {
      ticketKey: diff.ticketKey,
      changedFiles: diff.changedFiles.map(({ additions, deletions, binary, ...file }) => file)
    })
  ]);
}

function isPackageJson(filePath: string): boolean {
  return path.posix.basename(filePath) === "package.json";
}

function isLockfile(filePath: string): boolean {
  return /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(filePath);
}

function isEnvironmentFile(filePath: string): boolean {
  return /(^|\/)\.env(?:\.|$)/.test(filePath);
}

function isBuildOrTestConfig(filePath: string): boolean {
  return /(^|\/)(?:tsconfig(?:\.[^/]+)?\.json|(?:vite|vitest|jest|playwright|webpack|rollup|next|babel|eslint)\.config\.[^/]+|setupTests\.[^/]+|test-setup\.[^/]+)$/.test(
    filePath
  );
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath) || /(^|\/)(__tests__|tests)\//.test(filePath);
}

function tokens(value: string): Set<string> {
  const stopWords = new Set([
    "about", "after", "before", "change", "changes", "code", "create", "current",
    "existing", "file", "files", "implementation", "implement", "plan", "selected",
    "should", "task", "test", "tests", "ticket", "update", "with"
  ]);
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopWords.has(token))
  );
}

function appearsRelated(filePath: string, context: string): boolean {
  if (isTestFile(filePath)) {
    return true;
  }
  const contextTokens = tokens(context);
  const pathTokens = tokens(filePath.replace(/\.[^.]+$/, ""));
  return [...pathTokens].some((token) => contextTokens.has(token));
}

function sensitiveArea(value: string): string | undefined {
  const normalized = value.toLowerCase();
  const areas: Array<[RegExp, string]> = [
    [/(auth|login|session|permission|role|access)/, "authentication or authorization"],
    [/(payment|checkout|billing|invoice)/, "payment"],
    [/(security|crypto|secret|token)/, "security"],
    [/(delete|destroy|purge|erase)/, "data deletion"]
  ];
  return areas.find(([pattern]) => pattern.test(normalized))?.[1];
}

function finding(
  id: string,
  severity: RiskSeverity,
  category: string,
  message: string,
  paths: string[],
  requiresStop: boolean
): RiskFinding {
  return { id, severity, category, message, paths, requiresStop };
}

export function detectRiskyChanges(options: {
  context: ImplementationContext;
  diff: DiffCollection;
  approvedConfigChanges?: boolean;
}): RiskDetection {
  const { context, diff } = options;
  const approvedConfigChanges =
    Boolean(options.approvedConfigChanges) || context.configChangeApproved;
  const findings: RiskFinding[] = [];
  const paths = diff.changedFiles.map((file) => file.path);
  const contextText = [
    context.intentSummary,
    context.inputs.taskSpec,
    context.inputs.testPlan
  ].join("\n");

  if (paths.length > 0 && isProtectedBranch(diff.branchName)) {
    findings.push(
      finding(
        "protected-branch",
        "critical",
        "git-safety",
        `Code changes are present directly on protected branch ${diff.branchName}.`,
        paths,
        true
      )
    );
  }
  if (paths.length > 20) {
    findings.push(
      finding(
        "changed-file-limit",
        "high",
        "change-size",
        `Changed file count ${paths.length} exceeds the Implementation limit of 20.`,
        paths,
        true
      )
    );
  }
  if (diff.diffLineCount > 500) {
    findings.push(
      finding(
        "diff-line-limit",
        "high",
        "change-size",
        `Diff line count ${diff.diffLineCount} exceeds the Implementation limit of 500.`,
        paths,
        true
      )
    );
  }
  const testFiles = diff.changedFiles.filter((file) => isTestFile(file.path));
  const testDiffLines = testFiles.reduce(
    (total, file) => total + file.additions + file.deletions,
    0
  );
  if (testFiles.length > 10 || testDiffLines > 300) {
    findings.push(
      finding(
        "large-test-change",
        "high",
        "test-scope",
        `Test changes are unusually large for Implementation (${testFiles.length} files, ${testDiffLines} diff lines) and must be checked against the Test Plan.`,
        testFiles.map((file) => file.path),
        true
      )
    );
  }

  const configGroups: Array<[string, string, (filePath: string) => boolean]> = [
    ["package-json", "package.json", isPackageJson],
    ["lockfile", "lockfile", isLockfile],
    ["environment-file", "environment file", isEnvironmentFile],
    ["build-test-config", "build or test config", isBuildOrTestConfig]
  ];
  for (const [id, label, predicate] of configGroups) {
    const matched = paths.filter(predicate);
    if (matched.length > 0) {
      findings.push(
        finding(
          id,
          approvedConfigChanges ? "medium" : "critical",
          "setup-change",
          approvedConfigChanges
            ? `${label} changes are present with test-planning or explicit approval.`
            : `${label} changes require test-planning approval before implementation.`,
          matched,
          !approvedConfigChanges
        )
      );
    }
  }

  const possiblyUnrelated = paths.filter(
    (filePath) =>
      !isPackageJson(filePath) &&
      !isLockfile(filePath) &&
      !isEnvironmentFile(filePath) &&
      !isBuildOrTestConfig(filePath) &&
      !appearsRelated(filePath, contextText)
  );
  if (possiblyUnrelated.length > 0) {
    findings.push(
      finding(
        "possible-out-of-scope",
        "medium",
        "scope",
        "These files have no clear path or name match with the user intent, Task Spec, or Test Plan and need manual scope review.",
        possiblyUnrelated,
        false
      )
    );
  }

  const sensitive = new Map<string, string[]>();
  for (const filePath of paths) {
    const area = sensitiveArea(filePath);
    if (area) {
      sensitive.set(area, [...(sensitive.get(area) ?? []), filePath]);
    }
  }
  for (const [area, matched] of sensitive) {
    findings.push(
      finding(
        `sensitive-${area.replace(/\s+/g, "-")}`,
        "high",
        "sensitive-area",
        `The diff touches ${area} logic and requires strict review and full local verification.`,
        matched,
        false
      )
    );
  }
  const contentArea = sensitiveArea(diff.diffContent);
  if (contentArea && !sensitive.has(contentArea)) {
    findings.push(
      finding(
        `sensitive-content-${contentArea.replace(/\s+/g, "-")}`,
        "high",
        "sensitive-area",
        `The tracked diff content touches ${contentArea} logic and requires strict review and full local verification.`,
        paths,
        false
      )
    );
  }

  return {
    ticketKey: context.ticketKey,
    branchName: diff.branchName,
    approvedConfigChanges,
    findings,
    shouldStop: findings.some((item) => item.requiresStop)
  };
}

function renderRiskReport(risk: RiskDetection, diff: DiffCollection): string {
  const findings = risk.findings.length > 0
    ? risk.findings
        .map(
          (item) => `### ${item.severity.toUpperCase()}: ${item.category}

- Finding: ${item.message}
- Stop required: ${item.requiresStop ? "yes" : "no"}
- Paths: ${item.paths.map((filePath) => `\`${filePath}\``).join(", ") || "None"}`
        )
        .join("\n\n")
    : "No risky changes were detected by the deterministic checks.";

  return `# Risk Detection Report

## Ticket

${risk.ticketKey}

## Branch

${risk.branchName}

## Result

- Stop required: ${risk.shouldStop ? "yes" : "no"}
- Test-planning or explicit config approval detected: ${risk.approvedConfigChanges ? "yes" : "no"}
- Changed files: ${diff.changedFiles.length}
- Diff line count: ${diff.diffLineCount}

## Findings

${findings}

## Boundary

This report is a deterministic pre-verification check. Local verification must perform full
lint, typecheck, test, build, browser, and failure analysis as applicable.
`;
}

export async function writeRiskArtifact(
  runDir: string,
  risk: RiskDetection,
  diff: DiffCollection
): Promise<void> {
  await writeTextFile(
    runDir,
    "risk-detection-report.md",
    renderRiskReport(risk, diff)
  );
}

function summarizeTestPlan(testPlan: string): string {
  const objectives = extractMarkdownSection(testPlan, "Test Objectives");
  const cases = (extractMarkdownSection(testPlan, "Test Cases").match(/^### Case /gm) ?? [])
    .length;
  return [
    objectives || "The Test Planning Test Plan was used.",
    cases > 0 ? `${cases} planned test case(s) were considered.` : ""
  ].filter(Boolean).join("\n\n");
}

function suggestedVerification(context: ImplementationContext): string {
  const commands = [
    ...context.inputs.testEnvironmentReport.matchAll(/`((?:pnpm|npm|yarn|npx)\s+[^`]+)`/g),
    ...context.inputs.taskSpec.matchAll(/`((?:pnpm|npm|yarn|npx)\s+[^`]+)`/g)
  ].map((match) => match[1]);
  return markdownList(
    [...new Set(commands)].map((command) => `\`${command}\``)
  );
}

async function renderTemplate(
  fileName: string,
  values: Record<string, string>
): Promise<string> {
  let template = await readFile(path.join(skillResources, fileName), "utf8");
  for (const [key, value] of Object.entries(values)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return `${template.trimEnd()}\n`;
}

function findingsList(findings: RiskFinding[]): string {
  return markdownList(
    findings.map(
      (item) =>
        `[${item.severity}] ${item.message}${
          item.paths.length > 0 ? ` Paths: ${item.paths.join(", ")}` : ""
        }`
    )
  );
}

function reviewDecision(
  risk: RiskDetection,
  intentConflict?: string
): "approved" | "approved_with_comments" | "needs_fix" | "blocked" {
  if (intentConflict?.trim()) {
    return "blocked";
  }
  if (
    risk.findings.some(
      (item) =>
        item.requiresStop &&
        (item.category === "git-safety" || item.category === "setup-change")
    )
  ) {
    return "blocked";
  }
  if (risk.shouldStop) {
    return "needs_fix";
  }
  return risk.findings.length > 0 ? "approved_with_comments" : "approved";
}

export async function writeImplementationSummary(options: {
  context: ImplementationContext;
  diff: DiffCollection;
  risk: RiskDetection;
  notes?: string;
}): Promise<string> {
  const testFiles = options.diff.changedFiles.filter((file) => isTestFile(file.path));
  const sourceFiles = options.diff.changedFiles.filter((file) => !isTestFile(file.path));
  const content = await renderTemplate("implementation-summary-template.md", {
    ticketKey: options.context.ticketKey,
    branchName: options.diff.branchName,
    userImplementationIntentSummary: options.context.intentSummary,
    testPlanSummary: summarizeTestPlan(options.context.inputs.testPlan),
    changeSummary: markdownList(
      sourceFiles.map((file) => `\`${file.path}\`: ${file.reason}`)
    ),
    testsSummary: markdownList(
      testFiles.map((file) => `\`${file.path}\`: ${file.reason}`)
    ),
    changedFilesSummary: markdownList(
      options.diff.changedFiles.map(
        (file) => `\`${file.path}\` (${file.changeType}, +${file.additions}/-${file.deletions})`
      )
    ),
    suggestedVerificationCommands: suggestedVerification(options.context),
    notes:
      options.notes?.trim() ||
      (options.risk.findings.length > 0
        ? "Review risk-detection-report.md before local verification."
        : "No additional implementation notes.")
  });
  await writeTextFile(options.context.runDir, "implementation-summary.md", content);
  return content;
}

export async function writeCodeReviewReport(options: {
  context: ImplementationContext;
  diff: DiffCollection;
  risk: RiskDetection;
  intentConflict?: string;
}): Promise<string> {
  const outOfScope = options.risk.findings.filter(
    (item) => item.category === "scope"
  );
  const required = options.risk.findings.filter((item) => item.requiresStop);
  const optional = options.risk.findings.filter((item) => !item.requiresStop);
  const testFiles = options.diff.changedFiles.filter((file) => isTestFile(file.path));
  const decision = reviewDecision(options.risk, options.intentConflict);
  const content = await renderTemplate("code-review-report-template.md", {
    decision,
    taskSpecAlignment:
      outOfScope.length > 0
        ? "Manual review is required for files that may not map to the Task Spec."
        : "The changed file set has no deterministic out-of-scope finding.",
    userIntentAlignment: options.intentConflict?.trim()
      ? `Conflict detected: ${options.intentConflict.trim()} User confirmation is required before implementation continues.`
      : "No user-intent conflict was reported to the generator.",
    testPlanAlignment:
      testFiles.length > 0
        ? `${testFiles.length} test file(s) were added or updated against the Test Planning Test Plan.`
        : "No test file change was detected. Confirm that existing coverage already satisfies the Test Plan.",
    testCodeChanges: markdownList(
      testFiles.map((file) => `\`${file.path}\`: ${file.reason}`)
    ),
    riskFindings: findingsList(options.risk.findings),
    outOfScopeChanges: findingsList(outOfScope),
    requiredFixes: markdownList([
      ...(options.intentConflict?.trim()
        ? [`Resolve the user intent conflict: ${options.intentConflict.trim()}`]
        : []),
      ...required.map((item) => item.message)
    ]),
    optionalImprovements: findingsList(optional)
  });
  await writeTextFile(options.context.runDir, "code-review-report.md", content);
  return content;
}

export async function updateImplementationAgentRunReport(options: {
  context: ImplementationContext;
  diff: DiffCollection;
  risk: RiskDetection;
}): Promise<void> {
  const artifactOrder = [
    "implementation-summary.md",
    "code-review-report.md",
    "diff-summary.md",
    "changed-files.json",
    "risk-detection-report.md"
  ];
  const artifacts = (
    await Promise.all(
      artifactOrder.map(async (fileName) => ({
        fileName,
        exists: await pathExists(path.join(options.context.runDir, fileName))
      }))
    )
  )
    .filter((item) => item.exists)
    .map((item) => `- ${item.fileName}`)
    .join("\n");
  const body = `- Status: ${options.risk.shouldStop ? "risk-stop-required" : "implementation-reported"}
- Updated at: ${new Date().toISOString()}
- Branch: ${options.diff.branchName}
- Changed files: ${options.diff.changedFiles.length}
- Diff line count: ${options.diff.diffLineCount}
- Risk findings: ${options.risk.findings.length}

### Generated Artifacts

${artifacts || "- None"}

### Implementation Boundary

- Full verification was not run.
- No commit, push, PR, Jira mutation, or Playwright MCP run was created.
`;
  await updateAgentRunReportSection(
    options.context.runDir,
    "Ticket Code Work",
    body
  );
}
