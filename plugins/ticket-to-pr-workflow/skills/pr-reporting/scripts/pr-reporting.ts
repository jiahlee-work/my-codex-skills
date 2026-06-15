import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  allowedCommitTypes,
  hasKoreanText,
  normalizeCommitSummary,
  validateCommitMessage,
  type CommitType
} from "../../branch-commit-policy/scripts/branch-commit-policy.js";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import { extractMarkdownSection, markdownList } from "../../../shared/core/markdown.js";
import { pathExists, writeTextFile } from "../../../shared/core/fs.js";
import { isProtectedBranch, parsePorcelainStatus, runGit } from "../../../shared/core/git-worktree.js";
import type {
  CommitStrategy,
  PrChangedFile,
  PrReportingContext
} from "./pr-context.js";

const execFileAsync = promisify(execFile);
const resourcesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../resources"
);

export type PlannedCommit = {
  message: string;
  files: string[];
};

export type CommitPlan = {
  ticketKey: string;
  strategy: CommitStrategy;
  commits: PlannedCommit[];
  dryRun: boolean;
};

export type CommitPlanValidation = {
  valid: boolean;
  commitConventionStatus: "pass" | "fail";
  ticketReferenceStatus: "pass" | "fail";
  allowedTypeStatus: "pass" | "fail";
  lowercaseTypeStatus: "pass" | "fail";
  scopeOmittedStatus: "pass" | "fail";
  koreanSummaryStatus: "pass" | "fail";
  errors: string[];
};

export type PrPrerequisites = {
  repository: string;
  currentBranch: string;
  plannedBranch: string;
  verificationResult: string;
  worktree: boolean;
  protectedBranch: boolean;
  uncommittedChanges: boolean;
  changedFiles: string[];
  originExists: boolean;
  originUrl?: string;
  forcePushRequired: boolean;
  secretAccessRequired: boolean;
  packageChangesApproved: boolean;
  storybookStatus: DeliveryVerificationStatus;
  browserScenarioStatus: DeliveryVerificationStatus;
  commitPolicyAvailable: boolean;
  ghInstalled: boolean;
  ghAuthenticated: boolean;
  githubMcpAvailable: boolean;
  githubTransport: "gh" | "mcp" | "unavailable";
  safeForPlanning: boolean;
  safeForExecution: boolean;
  errors: string[];
  executionBlockers: string[];
  warnings: string[];
};

export type PrPlan = {
  ticketKey: string;
  branchName: string;
  baseBranch: string;
  commitStrategy: CommitStrategy;
  prTitle: string;
  storybookStatus: DeliveryVerificationStatus;
  browserScenarioStatus: DeliveryVerificationStatus;
  executionMode: "dry-run" | "execute";
  commands: string[];
  approvalRequired: string;
};

export type DeliveryVerificationStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "approval-required"
  | "not-run";

export type DeliveryVerificationGates = {
  storybookStatus: DeliveryVerificationStatus;
  browserScenarioStatus: DeliveryVerificationStatus;
  blockers: string[];
};

export type ExecutionResult = {
  status: "dry-run" | "created" | "failed";
  commitHashes: string[];
  pushed: boolean;
  prUrl?: string;
  error?: string;
};

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath) ||
    /\.stories\.[^/]+$/.test(filePath) ||
    /(^|\/)(__tests__|tests)\//.test(filePath)
  );
}

function isDocsFile(filePath: string): boolean {
  return (
    /(^|\/)(README|CHANGELOG|CONTRIBUTING)(?:\.[^/]+)?$/i.test(filePath) ||
    /\.(md|mdx|rst|txt)$/i.test(filePath)
  );
}

function isPackageOrLockfile(filePath: string): boolean {
  return /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/.test(
    filePath
  );
}

function isSupportFile(filePath: string): boolean {
  return (
    isPackageOrLockfile(filePath) ||
    /(^|\/)(?:tsconfig(?:\.[^/]+)?\.json|(?:vite|vitest|jest|playwright|webpack|rollup|next|babel|eslint|biome)\.config\.[^/]+|\.github\/)/.test(
      filePath
    )
  );
}

function isSecretPath(filePath: string): boolean {
  return /(^|\/)(?:\.env(?:\..*)?|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|id_rsa|[^/]+\.(?:pem|key|p12|pfx))$/i.test(
    filePath
  );
}

function firstMeaningfulLine(value?: string): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/^#+\s+/, "")
    )
    .find((line) => Boolean(line) && !/^none[.]?$/i.test(line));
}

function normalizeSummary(value: string): string {
  return normalizeCommitSummary(value);
}

function cleanTopic(value: string): string {
  return normalizeSummary(value).replace(
    /^(?:add|update|implement|change|create|fix|refactor)\s+/i,
    ""
  );
}

function topicFor(context: PrReportingContext): string {
  const proposedCommit = extractMarkdownSection(
    context.inputs.branchCommitPlan,
    "Proposed Commit"
  );
  const proposedSummary = proposedCommit.match(
    /^(?:feat|fix|test|refactor|chore|docs):\s+(.+)$/m
  )?.[1];
  const changed = firstMeaningfulLine(
    extractMarkdownSection(context.inputs.implementationSummary, "What Changed")
  );
  const ticketLine = firstMeaningfulLine(
    extractMarkdownSection(context.inputs.ticketContextReport ?? "", "Ticket")
  )?.replace(new RegExp(`^${context.ticketKey}\\s*`), "");
  return cleanTopic(proposedSummary ?? changed ?? ticketLine ?? context.ticketKey);
}

function implementationType(context: PrReportingContext): CommitType {
  const proposedCommit = extractMarkdownSection(
    context.inputs.branchCommitPlan,
    "Proposed Commit"
  ).match(/^(feat|fix|test|refactor|chore|docs):/m)?.[1] as
    | CommitType
    | undefined;
  if (proposedCommit && allowedCommitTypes.includes(proposedCommit)) {
    return proposedCommit;
  }
  if (context.branchName.startsWith("fix/")) {
    return "fix";
  }
  if (context.branchName.startsWith("chore/")) {
    return "chore";
  }
  return "feat";
}

function commitMessage(
  type: CommitType,
  summary: string,
  ticketKey: string
): string {
  return `${type}: ${normalizeSummary(summary)}\nRefs: ${ticketKey}`;
}

function filesByCategory(files: PrChangedFile[]): {
  tests: string[];
  implementation: string[];
  docs: string[];
  support: string[];
} {
  const groups = {
    tests: [] as string[],
    implementation: [] as string[],
    docs: [] as string[],
    support: [] as string[]
  };
  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (isTestFile(filePath)) {
      groups.tests.push(filePath);
    } else if (isDocsFile(filePath)) {
      groups.docs.push(filePath);
    } else if (isSupportFile(filePath)) {
      groups.support.push(filePath);
    } else {
      groups.implementation.push(filePath);
    }
  }
  return groups;
}

function pushCommit(
  commits: PlannedCommit[],
  files: string[],
  type: CommitType,
  summary: string,
  ticketKey: string
): void {
  if (files.length > 0) {
    commits.push({
      message: commitMessage(type, summary, ticketKey),
      files
    });
  }
}

export function buildCommitPlan(options: {
  context: PrReportingContext;
  strategy?: CommitStrategy;
  dryRun?: boolean;
}): CommitPlan {
  const strategy = options.strategy ?? "logical";
  const changedFiles = options.context.inputs.changedFilesArtifact.changedFiles;
  const allFiles = changedFiles.map((file) => normalizePath(file.path));
  const groups = filesByCategory(changedFiles);
  const topic = topicFor(options.context);
  const productType = implementationType(options.context);
  const commits: PlannedCommit[] = [];

  if (strategy === "squash") {
    const type: CommitType =
      groups.implementation.length > 0
        ? productType
        : groups.tests.length > 0
          ? "test"
          : groups.docs.length > 0 && groups.support.length === 0
            ? "docs"
            : "chore";
    pushCommit(commits, allFiles, type, topic, options.context.ticketKey);
  } else if (strategy === "step-based") {
    pushCommit(
      commits,
      groups.tests,
      "test",
      `${topic} 테스트 추가`,
      options.context.ticketKey
    );
    pushCommit(
      commits,
      groups.implementation,
      productType,
      topic,
      options.context.ticketKey
    );
    pushCommit(
      commits,
      [...groups.support, ...groups.docs],
      groups.support.length > 0 ? "chore" : "docs",
      `${topic} 지원 파일 업데이트`,
      options.context.ticketKey
    );
  } else {
    pushCommit(
      commits,
      groups.tests,
      "test",
      `${topic} 테스트 추가`,
      options.context.ticketKey
    );
    pushCommit(
      commits,
      groups.implementation,
      productType,
      topic,
      options.context.ticketKey
    );
    pushCommit(
      commits,
      groups.docs,
      "docs",
      `${topic} 문서화`,
      options.context.ticketKey
    );
    pushCommit(
      commits,
      groups.support,
      "chore",
      `${topic} 도구 설정 업데이트`,
      options.context.ticketKey
    );
  }

  return {
    ticketKey: options.context.ticketKey,
    strategy,
    commits,
    dryRun: options.dryRun ?? true
  };
}

export function validateCommitPlan(
  plan: CommitPlan,
  expectedFiles: string[]
): CommitPlanValidation {
  const errors: string[] = [];
  const messageResults = plan.commits.map((commit, index) => {
    const result = validateCommitMessage(commit.message, plan.ticketKey);
    if (!result.valid) {
      errors.push(
        ...result.errors.map((error) => `Commit ${index + 1}: ${error}`)
      );
    }
    return result;
  });
  const plannedFiles = plan.commits.flatMap((commit) => commit.files.map(normalizePath));
  const expected = [...new Set(expectedFiles.map(normalizePath))].sort();
  const actual = [...new Set(plannedFiles)].sort();
  const duplicates = plannedFiles.filter(
    (file, index) => plannedFiles.indexOf(file) !== index
  );
  if (duplicates.length > 0) {
    errors.push(`Files assigned to multiple commits: ${[...new Set(duplicates)].join(", ")}`);
  }
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));
  if (missing.length > 0) {
    errors.push(`Changed files missing from commit plan: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    errors.push(`Commit plan contains unexpected files: ${unexpected.join(", ")}`);
  }
  if (plan.commits.length === 0) {
    errors.push("Commit plan contains no commits.");
  }

  const subjects = plan.commits.map((commit) => commit.message.split("\n")[0] ?? "");
  const commitConventionStatus = messageResults.every((result) => result.valid)
    ? "pass"
    : "fail";
  const ticketReferenceStatus = plan.commits.every((commit) =>
    commit.message.includes(`Refs: ${plan.ticketKey}`)
  )
    ? "pass"
    : "fail";
  const subjectTypes = subjects.map(
    (subject) => /^([A-Za-z]+)(?:\([^)]+\))?:\s+/.exec(subject)?.[1]
  );
  const allowedTypeStatus = subjectTypes.every((type) =>
    Boolean(type && allowedCommitTypes.includes(type as CommitType))
  )
    ? "pass"
    : "fail";
  const lowercaseTypeStatus = subjectTypes.every((type) =>
    Boolean(type && type === type.toLowerCase())
  )
    ? "pass"
    : "fail";
  const scopeOmittedStatus = subjects.every(
    (subject) => !/^[A-Za-z]+\([^)]+\):/.test(subject)
  )
    ? "pass"
    : "fail";
  const koreanSummaryStatus = subjects.every((subject) => {
    const summary = /^(?:feat|fix|test|refactor|chore|docs):\s+(.+)$/.exec(subject)?.[1];
    return Boolean(summary && hasKoreanText(summary));
  })
    ? "pass"
    : "fail";

  return {
    valid: errors.length === 0,
    commitConventionStatus,
    ticketReferenceStatus,
    allowedTypeStatus,
    lowercaseTypeStatus,
    scopeOmittedStatus,
    koreanSummaryStatus,
    errors
  };
}

async function renderTemplate(
  fileName: string,
  values: Record<string, string>
): Promise<string> {
  let template = await readFile(path.join(resourcesDir, fileName), "utf8");
  for (const [key, value] of Object.entries(values)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return `${template.trimEnd()}\n`;
}

function renderPlannedCommits(commits: PlannedCommit[]): string {
  return commits
    .map(
      (commit, index) => `### Commit ${index + 1}

\`\`\`text
${commit.message}
\`\`\`

Files:
${commit.files.map((file) => `- \`${file}\``).join("\n")}`
    )
    .join("\n\n");
}

function renderFilesPerCommit(commits: PlannedCommit[]): string {
  return [
    "| Commit | Files |",
    "| --- | --- |",
    ...commits.map(
      (commit, index) =>
        `| ${index + 1} | ${commit.files.map((file) => `\`${file}\``).join("<br>")} |`
    )
  ].join("\n");
}

export async function writeCommitPlan(
  context: PrReportingContext,
  plan: CommitPlan
): Promise<CommitPlanValidation> {
  const expectedFiles = context.inputs.changedFilesArtifact.changedFiles.map(
    (file) => file.path
  );
  const validation = validateCommitPlan(plan, expectedFiles);
  const content = await renderTemplate("commit-pr-policy.md", {
    ticketKey: plan.ticketKey,
    strategy: plan.strategy,
    plannedCommits: renderPlannedCommits(plan.commits),
    filesPerCommit: renderFilesPerCommit(plan.commits),
    commitConventionStatus: validation.commitConventionStatus,
    ticketReferenceStatus: validation.ticketReferenceStatus,
    allowedTypeStatus: validation.allowedTypeStatus,
    lowercaseTypeStatus: validation.lowercaseTypeStatus,
    scopeOmittedStatus: validation.scopeOmittedStatus,
    koreanSummaryStatus: validation.koreanSummaryStatus,
    dryRunStatus: plan.dryRun
      ? "Dry-run only. No commit, push, or PR was created."
      : "Execution was explicitly requested and still requires final prerequisite checks."
  });
  await writeTextFile(context.runDir, "commit-plan.md", content);
  return validation;
}

export function parseCommitPlan(markdown: string): CommitPlan {
  const ticketKey = firstMeaningfulLine(extractMarkdownSection(markdown, "Ticket"));
  const strategy = firstMeaningfulLine(
    extractMarkdownSection(markdown, "Strategy")
  ) as CommitStrategy | undefined;
  if (!ticketKey || !/^[A-Z][A-Z0-9]+-\d+$/.test(ticketKey)) {
    throw new Error("commit-plan.md has an invalid Ticket section.");
  }
  if (!strategy || !["logical", "squash", "step-based"].includes(strategy)) {
    throw new Error("commit-plan.md has an invalid Strategy section.");
  }
  const plannedSection = extractMarkdownSection(markdown, "Planned Commits");
  const matches = [
    ...plannedSection.matchAll(
      /### Commit \d+\s+```text\s*\r?\n([\s\S]*?)\r?\n```\s+Files:\s*\r?\n([\s\S]*?)(?=\r?\n### Commit \d+|$)/g
    )
  ];
  const commits = matches.map((match) => ({
    message: (match[1] ?? "").trim(),
    files: [...(match[2] ?? "").matchAll(/^-\s+`([^`]+)`\s*$/gm)].map(
      (fileMatch) => fileMatch[1] as string
    )
  }));
  const dryRun = /Dry-run only/i.test(extractMarkdownSection(markdown, "Dry Run"));
  return { ticketKey, strategy, commits, dryRun };
}

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args, {
      encoding: "utf8",
      timeout: 15_000
    });
    return true;
  } catch {
    return false;
  }
}

async function runGitNonInteractive(
  repository: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(
      "git",
      ["-C", repository, "-c", "credential.interactive=never", ...args],
      {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_SSH_COMMAND: "ssh -o BatchMode=yes"
        }
      }
    );
  } catch (error) {
    const failure = error as {
      stderr?: string;
      message?: string;
    };
    throw new Error(
      `Git command failed: git ${args.join(" ")}\n${
        failure.stderr ?? failure.message ?? ""
      }`.trim()
    );
  }
}

async function remoteBranchExists(
  repository: string,
  branchName: string
): Promise<boolean> {
  return (
    await runGit(
      repository,
      ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branchName}`],
      true
    )
  ).exitCode === 0;
}

async function reportStatus(
  runDir: string,
  fileName: string,
  headings: string[]
): Promise<DeliveryVerificationStatus> {
  const filePath = path.join(runDir, fileName);
  if (!(await pathExists(filePath))) {
    return "not-run";
  }
  const report = await readFile(filePath, "utf8");
  for (const heading of headings) {
    const value = firstMeaningfulLine(extractMarkdownSection(report, heading))
      ?.toLowerCase()
      .trim();
    if (
      value === "passed" ||
      value === "failed" ||
      value === "skipped" ||
      value === "approval-required"
    ) {
      return value;
    }
  }
  return "not-run";
}

export async function inspectDeliveryVerificationGates(options: {
  runDir: string;
  approvedStorybookSkip?: boolean;
  approvedBrowserSkip?: boolean;
}): Promise<DeliveryVerificationGates> {
  const storybookStatus = await reportStatus(
    options.runDir,
    "storybook-report.md",
    ["Storybook Status", "Status", "Result"]
  );
  const browserScenarioStatus = await reportStatus(
    options.runDir,
    "browser-verification-report.md",
    ["Browser Verification Status", "Browser Scenario Status", "Status", "Result"]
  );
  const legacyBrowserScenarioStatus =
    browserScenarioStatus === "not-run"
      ? await reportStatus(
          options.runDir,
          "browser-scenario-report.md",
          [
            "Browser Verification Status",
            "Browser Scenario Status",
            "Status",
            "Result"
          ]
        )
      : "not-run";
  const effectiveBrowserScenarioStatus =
    browserScenarioStatus === "not-run"
      ? legacyBrowserScenarioStatus
      : browserScenarioStatus;
  const blockers: string[] = [];

  if (storybookStatus === "not-run") {
    blockers.push(
      "storybook-report.md is required before commit, push, or PR execution."
    );
  } else if (storybookStatus === "failed") {
    blockers.push("Storybook verification failed.");
  } else if (storybookStatus === "approval-required") {
    blockers.push("Storybook verification still requires user approval.");
  } else if (storybookStatus === "skipped" && !options.approvedStorybookSkip) {
    blockers.push(
      "Skipped Storybook verification requires --approve-storybook-skip."
    );
  }

  if (effectiveBrowserScenarioStatus === "not-run") {
    blockers.push(
      "browser-verification-report.md is required before commit, push, or PR execution."
    );
  } else if (effectiveBrowserScenarioStatus === "failed") {
    blockers.push("Browser scenario verification failed.");
  } else if (effectiveBrowserScenarioStatus === "approval-required") {
    blockers.push("Browser scenario verification still requires user approval.");
  } else if (
    effectiveBrowserScenarioStatus === "skipped" &&
    !options.approvedBrowserSkip
  ) {
    blockers.push(
      "Skipped browser scenario verification requires --approve-browser-skip."
    );
  }

  return {
    storybookStatus,
    browserScenarioStatus: effectiveBrowserScenarioStatus,
    blockers
  };
}

export async function inspectPrPrerequisites(options: {
  context: PrReportingContext;
  repository: string;
  approvedPackageChanges?: boolean;
  approvedStorybookSkip?: boolean;
  approvedBrowserSkip?: boolean;
  githubMcpAvailable?: boolean;
}): Promise<PrPrerequisites> {
  const errors: string[] = [];
  const executionBlockers: string[] = [];
  const warnings: string[] = [];
  const worktreeCheck = await runGit(
    options.repository,
    ["rev-parse", "--is-inside-work-tree"],
    true
  );
  const worktree =
    worktreeCheck.exitCode === 0 && worktreeCheck.stdout.trim() === "true";
  if (!worktree) {
    errors.push(`Not a Git worktree: ${options.repository}`);
  }

  let currentBranch = "";
  let changedFiles: string[] = [];
  let rawOriginUrl: string | undefined;
  let forcePushRequired = false;
  if (worktree) {
    currentBranch = (
      await runGit(options.repository, ["branch", "--show-current"], true)
    ).stdout.trim();
    if (!currentBranch) {
      errors.push("Detached HEAD is not supported in PR Reporting.");
    }
    const status = await runGit(options.repository, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all"
    ]);
    changedFiles = parsePorcelainStatus(status.stdout)
      .map((entry) => normalizePath(entry.path))
      .filter(
        (filePath) =>
          filePath !== ".agent-runs" && !filePath.startsWith(".agent-runs/")
      );
    const origin = await runGit(
      options.repository,
      ["remote", "get-url", "origin"],
      true
    );
    if (origin.exitCode === 0 && origin.stdout.trim()) {
      rawOriginUrl = origin.stdout.trim();
    }
    if (
      currentBranch &&
      (await remoteBranchExists(options.repository, currentBranch))
    ) {
      forcePushRequired =
        (
          await runGit(
            options.repository,
            [
              "merge-base",
              "--is-ancestor",
              `refs/remotes/origin/${currentBranch}`,
              "HEAD"
            ],
            true
          )
        ).exitCode !== 0;
    }
  }

  const expectedFiles = options.context.inputs.changedFilesArtifact.changedFiles.map(
    (file) => normalizePath(file.path)
  );
  const uncommittedChanges = changedFiles.length > 0;
  if (!uncommittedChanges) {
    errors.push("No uncommitted changes were found.");
  }
  const missingFromWorktree = expectedFiles.filter(
    (filePath) => !changedFiles.includes(filePath)
  );
  const unexpectedChanges = changedFiles.filter(
    (filePath) => !expectedFiles.includes(filePath)
  );
  if (missingFromWorktree.length > 0) {
    errors.push(
      `changed-files.json entries are not present in the worktree: ${missingFromWorktree.join(", ")}`
    );
  }
  if (unexpectedChanges.length > 0) {
    errors.push(
      `Unplanned worktree changes are present: ${unexpectedChanges.join(", ")}`
    );
  }
  const protectedBranch = isProtectedBranch(currentBranch);
  if (protectedBranch) {
    errors.push(`Refusing PR Reporting on protected branch ${currentBranch}.`);
  }
  if (currentBranch && currentBranch !== options.context.branchName) {
    errors.push(
      `Current branch ${currentBranch} does not match planned branch ${options.context.branchName}.`
    );
  }
  if (options.context.verificationResult !== "passed") {
    errors.push(
      `verification-report.md result must be passed, received ${options.context.verificationResult}.`
    );
  }
  const originHasEmbeddedCredentials = Boolean(
    rawOriginUrl && /^[a-z][a-z0-9+.-]*:\/\/[^/@\s]+@/i.test(rawOriginUrl)
  );
  const originUrl = originHasEmbeddedCredentials
    ? "[redacted credential-bearing URL]"
    : rawOriginUrl;
  const originExists = Boolean(rawOriginUrl);
  if (!originExists) {
    errors.push("Git remote origin is required.");
  }
  if (originHasEmbeddedCredentials) {
    errors.push("Origin URL contains embedded credentials; secret access is not allowed.");
  }
  const githubOrigin = Boolean(
    rawOriginUrl &&
      (/^git@github\.com:/i.test(rawOriginUrl) ||
        /^ssh:\/\/git@github\.com\//i.test(rawOriginUrl) ||
        /^https:\/\/github\.com\//i.test(rawOriginUrl))
  );
  if (originExists && !githubOrigin) {
    executionBlockers.push(
      "Remote origin is not a supported github.com URL; local execution cannot create a GitHub PR."
    );
  }
  if (forcePushRequired) {
    errors.push("The remote branch is not an ancestor of HEAD; a force push would be required.");
  }
  const secretAccessRequired = expectedFiles.some(isSecretPath);
  if (secretAccessRequired) {
    errors.push("Changed files include secret or credential paths.");
  }

  const packageFiles = expectedFiles.filter(isPackageOrLockfile);
  const packageChangesApproved =
    packageFiles.length === 0 || Boolean(options.approvedPackageChanges);
  if (!packageChangesApproved) {
    executionBlockers.push(
      `Package or lockfile changes require --approved-package-changes: ${packageFiles.join(", ")}`
    );
  }

  const deliveryGates = await inspectDeliveryVerificationGates({
    runDir: options.context.runDir,
    approvedStorybookSkip: options.approvedStorybookSkip,
    approvedBrowserSkip: options.approvedBrowserSkip
  });
  executionBlockers.push(...deliveryGates.blockers);

  const ghInstalled = await commandAvailable("gh", ["--version"]);
  const ghAuthenticated =
    ghInstalled && (await commandAvailable("gh", ["auth", "status"]));
  const githubMcpAvailable = Boolean(options.githubMcpAvailable);
  const githubTransport = ghAuthenticated
    ? "gh"
    : githubMcpAvailable
      ? "mcp"
      : "unavailable";
  if (githubTransport === "unavailable") {
    executionBlockers.push(
      "No authenticated GitHub CLI or declared GitHub MCP integration is available."
    );
    warnings.push(
      "Dry-run artifacts can still be generated; PR execution remains blocked."
    );
  } else if (!ghAuthenticated && githubMcpAvailable) {
    executionBlockers.push(
      "The local execute script requires authenticated GitHub CLI; use the generated plan with GitHub MCP instead."
    );
  }

  const identityName = worktree
    ? (await runGit(options.repository, ["config", "user.name"], true)).stdout.trim()
    : "";
  const identityEmail = worktree
    ? (await runGit(options.repository, ["config", "user.email"], true)).stdout.trim()
    : "";
  if (!identityName || !identityEmail) {
    executionBlockers.push("Git user.name and user.email must be configured.");
  }

  return {
    repository: options.repository,
    currentBranch,
    plannedBranch: options.context.branchName,
    verificationResult: options.context.verificationResult,
    worktree,
    protectedBranch,
    uncommittedChanges,
    changedFiles,
    originExists,
    originUrl,
    forcePushRequired,
    secretAccessRequired,
    packageChangesApproved,
    storybookStatus: deliveryGates.storybookStatus,
    browserScenarioStatus: deliveryGates.browserScenarioStatus,
    commitPolicyAvailable: typeof validateCommitMessage === "function",
    ghInstalled,
    ghAuthenticated,
    githubMcpAvailable,
    githubTransport,
    safeForPlanning: errors.length === 0,
    safeForExecution: errors.length === 0 && executionBlockers.length === 0,
    errors,
    executionBlockers,
    warnings
  };
}

function compactSection(markdown: string | undefined, heading: string): string {
  const section = extractMarkdownSection(markdown ?? "", heading).trim();
  return section.length > 1_500 ? `${section.slice(0, 1_500).trimEnd()}...` : section;
}

function meaningfulSection(markdown: string | undefined, heading: string): string {
  const section = compactSection(markdown, heading);
  const contentLines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return contentLines.length > 0 &&
    contentLines.every((line) => /^[-*]?\s*(?:none|not applicable)[.]?$/i.test(line))
    ? ""
    : section;
}

function nonEmpty(value: string, fallback: string): string {
  return value.trim() || fallback;
}

export async function generatePrDescription(
  context: PrReportingContext
): Promise<string> {
  const implementationChanges = compactSection(
    context.inputs.implementationSummary,
    "What Changed"
  );
  const summary = nonEmpty(
    implementationChanges ||
      compactSection(context.inputs.requirementSummary, "Description") ||
      compactSection(context.inputs.taskSpec, "Objective"),
    `Implement the approved changes for ${context.ticketKey}.`
  );
  const changes = context.inputs.changedFilesArtifact.changedFiles
    .map(
      (file) =>
        `- \`${normalizePath(file.path)}\`${file.reason ? `: ${file.reason}` : ""}`
    )
    .join("\n");
  const testPlan = nonEmpty(
    compactSection(context.inputs.taskSpec, "Test Plan Draft") ||
      compactSection(context.inputs.verificationReport, "Commands"),
    "See verification results below."
  );
  const verificationSummary = `Result: ${context.verificationResult}\n\n${nonEmpty(
    compactSection(context.inputs.verificationReport, "Summary"),
    "Verification completed."
  )}`;
  const reviewFocus = nonEmpty(
    [
      meaningfulSection(context.inputs.codeReviewReport, "Task Spec Alignment"),
      meaningfulSection(context.inputs.codeReviewReport, "Required Fixes")
    ]
      .filter(Boolean)
      .join("\n\n"),
    "Review ticket alignment, behavior changes, and focused test coverage."
  );
  const riskNotes = nonEmpty(
    [
      meaningfulSection(context.inputs.codeReviewReport, "Risk Findings"),
      meaningfulSection(context.inputs.riskDetectionReport, "Findings"),
      meaningfulSection(context.inputs.planCriticReport, "Risks")
    ]
      .filter(Boolean)
      .join("\n\n"),
    "- None identified."
  );
  const content = await renderTemplate("pr-description-template.md", {
    summary,
    ticketKey: context.ticketKey,
    changes: changes || "- None",
    testPlan,
    verificationSummary,
    reviewFocus,
    riskNotes
  });
  await writeTextFile(context.runDir, "pr-description.md", content);
  return content;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

async function detectBaseBranch(repository: string): Promise<string> {
  const symbolic = await runGit(
    repository,
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    true
  );
  if (symbolic.exitCode === 0 && symbolic.stdout.trim().startsWith("origin/")) {
    return symbolic.stdout.trim().slice("origin/".length);
  }
  for (const candidate of ["main", "master", "develop"]) {
    if (await remoteBranchExists(repository, candidate)) {
      return candidate;
    }
  }
  return "main";
}

function titleFor(plan: CommitPlan, ticketKey: string): string {
  const preferred =
    plan.commits.find((commit) => !commit.message.startsWith("test: ")) ??
    plan.commits[0];
  const subject = preferred?.message.split("\n")[0] ?? `chore: complete ${ticketKey}`;
  return `${subject} (${ticketKey})`;
}

export async function buildPrPlan(options: {
  context: PrReportingContext;
  repository: string;
  commitPlan: CommitPlan;
  baseBranch?: string;
  title?: string;
  execute?: boolean;
}): Promise<PrPlan> {
  const baseBranch = options.baseBranch ?? (await detectBaseBranch(options.repository));
  if (isProtectedBranch(options.context.branchName)) {
    throw new Error("Protected branches cannot be used as the PR head branch.");
  }
  const prTitle = options.title?.trim() || titleFor(
    options.commitPlan,
    options.context.ticketKey
  );
  const commands = options.commitPlan.commits.flatMap((commit) => {
    const [subject, ...bodyLines] = commit.message.split("\n");
    return [
      `git add -- ${commit.files.map(shellQuote).join(" ")}`,
      `git commit -m ${shellQuote(subject ?? "")}${
        bodyLines.length > 0
          ? ` -m ${shellQuote(bodyLines.join("\n"))}`
          : ""
      }`
    ];
  });
  commands.push(
    `git push -u origin ${shellQuote(options.context.branchName)}`,
    `gh pr create --base ${shellQuote(baseBranch)} --head ${shellQuote(
      options.context.branchName
    )} --title ${shellQuote(prTitle)} --body-file ${shellQuote(
      path.join(options.context.runDir, "pr-description.md")
    )}`
  );
  const deliveryGates = await inspectDeliveryVerificationGates({
    runDir: options.context.runDir
  });
  return {
    ticketKey: options.context.ticketKey,
    branchName: options.context.branchName,
    baseBranch,
    commitStrategy: options.commitPlan.strategy,
    prTitle,
    storybookStatus: deliveryGates.storybookStatus,
    browserScenarioStatus: deliveryGates.browserScenarioStatus,
    executionMode: options.execute ? "execute" : "dry-run",
    commands,
    approvalRequired: options.execute
      ? "Explicit approval was supplied with --execute. Storybook, Browser Verification, and final safety checks still apply."
      : "Yes. Complete Storybook and Browser Verification, then run execute-commit-and-pr.ts with --execute after final approval."
  };
}

export async function writePrPlan(
  context: PrReportingContext,
  plan: PrPlan
): Promise<void> {
  const content = await renderTemplate("pr-plan-template.md", {
    ticketKey: plan.ticketKey,
    branchName: plan.branchName,
    baseBranch: plan.baseBranch,
    commitStrategy: plan.commitStrategy,
    prTitle: plan.prTitle,
    storybookStatus: plan.storybookStatus,
    browserScenarioStatus: plan.browserScenarioStatus,
    dryRunOrExecute: plan.executionMode,
    commands: plan.commands.join("\n"),
    approvalRequired: plan.approvalRequired
  });
  await writeTextFile(context.runDir, "pr-plan.md", content);
}

async function existingArtifacts(runDir: string): Promise<string[]> {
  const artifactOrder = [
    "ticket-context-report.md",
    "requirement-summary.md",
    "task-spec.md",
    "plan-critic-report.md",
    "branch-commit-plan.md",
    "test-environment-report.md",
    "test-plan.md",
    "diff-summary.md",
    "changed-files.json",
    "implementation-summary.md",
    "code-review-report.md",
    "risk-detection-report.md",
    "verification-report.md",
    "failure-report.md",
    "commit-plan.md",
    "pr-description.md",
    "pr-plan.md",
    "storybook-environment-report.md",
    "storybook-setup-proposal.md",
    "storybook-plan.md",
    "stories-changed.json",
    "storybook-report.md",
    "browser-scenario-plan.md",
    "browser-verification-report.md"
  ];
  const entries = new Set(await readdir(runDir));
  return artifactOrder.filter((fileName) => entries.has(fileName));
}

function jiraSource(context: PrReportingContext): string {
  return (
    context.inputs.ticketContextReport?.match(/^- Source:\s*(.+)$/m)?.[1] ??
    context.inputs.agentRunReport?.match(/^- Ticket Source:\s*(.+)$/m)?.[1] ??
    "unknown"
  );
}

function remainingRisks(context: PrReportingContext): string {
  const risks = [
    compactSection(context.inputs.codeReviewReport, "Risk Findings"),
    compactSection(context.inputs.riskDetectionReport, "Findings"),
    compactSection(context.inputs.planCriticReport, "Risks")
  ].filter(
    (value) =>
      Boolean(value) &&
      !/^[-*]\s*(?:none|no risky changes were detected)[.]?$/i.test(value)
  );
  return risks.length > 0 ? risks.join("\n\n") : "- None";
}

export async function finalizeAgentRunReport(options: {
  context: PrReportingContext;
  commitPlan: CommitPlan;
  prPlan: PrPlan;
  execution: ExecutionResult;
}): Promise<string> {
  const changedFiles = options.context.inputs.changedFilesArtifact.changedFiles.map(
    (file) => `- \`${normalizePath(file.path)}\``
  );
  const commitSummary = options.commitPlan.commits.map(
    (commit, index) =>
      `- Commit ${index + 1}: \`${commit.message.split("\n")[0]}\` (${commit.files.length} file(s))`
  );
  const artifactLinks = (await existingArtifacts(options.context.runDir)).map(
    (fileName) => `- [${fileName}](${fileName})`
  );
  const dryRun = options.execution.status === "dry-run";
  const prStatus =
    options.execution.status === "created"
      ? "created"
      : options.execution.status === "failed"
        ? "failed"
        : "not created (dry-run)";
  const content = await renderTemplate("agent-run-report-final-template.md", {
    ticketKey: options.context.ticketKey,
    jiraSource: jiraSource(options.context),
    userImplementationIntent: nonEmpty(
      compactSection(
        options.context.inputs.userImplementationIntent,
        "Summary"
      ),
      "Not recorded."
    ),
    branchName: options.context.branchName,
    changedFiles: markdownList(changedFiles.map((item) => item.replace(/^-\s+/, ""))),
    verificationResult: options.context.verificationResult,
    storybookStatus: options.prPlan.storybookStatus,
    browserScenarioStatus: options.prPlan.browserScenarioStatus,
    commitStrategy: options.commitPlan.strategy,
    commitPlan: commitSummary.join("\n") || "- None",
    prStatus,
    prUrl: options.execution.prUrl ?? "not created",
    dryRun: dryRun ? "yes" : "no",
    phaseArtifacts: artifactLinks.join("\n") || "- None",
    remainingRisks: remainingRisks(options.context),
    executionNotes: options.execution.error
      ? `- ${options.execution.error}`
      : dryRun
        ? "- No commit, push, PR, remote mutation, or GitHub Actions wait was performed."
        : `- Created ${options.execution.commitHashes.length} commit(s) and pushed the current branch.`
  });
  return updateAgentRunReportSection(
    options.context.runDir,
    "PR Delivery",
    content
  );
}

async function readAndValidatePlan(context: PrReportingContext): Promise<CommitPlan> {
  const planPath = path.join(context.runDir, "commit-plan.md");
  if (!(await pathExists(planPath))) {
    throw new Error(`Commit plan not found: ${planPath}`);
  }
  const plan = parseCommitPlan(await readFile(planPath, "utf8"));
  const validation = validateCommitPlan(
    plan,
    context.inputs.changedFilesArtifact.changedFiles.map((file) => file.path)
  );
  if (!validation.valid) {
    throw new Error(`Commit plan validation failed:\n${validation.errors.join("\n")}`);
  }
  return plan;
}

export async function readValidatedCommitPlan(
  context: PrReportingContext
): Promise<CommitPlan> {
  return readAndValidatePlan(context);
}

export async function executeCommitAndPr(options: {
  context: PrReportingContext;
  repository: string;
  baseBranch?: string;
  title?: string;
  execute: boolean;
  approvedPackageChanges?: boolean;
  approvedStorybookSkip?: boolean;
  approvedBrowserSkip?: boolean;
  githubMcpAvailable?: boolean;
}): Promise<ExecutionResult> {
  const prerequisites = await inspectPrPrerequisites({
    context: options.context,
    repository: options.repository,
    approvedPackageChanges: options.approvedPackageChanges,
    approvedStorybookSkip: options.approvedStorybookSkip,
    approvedBrowserSkip: options.approvedBrowserSkip,
    githubMcpAvailable: options.githubMcpAvailable
  });
  if (!prerequisites.safeForPlanning) {
    throw new Error(prerequisites.errors.join("\n"));
  }
  const commitPlan = await readAndValidatePlan(options.context);
  await generatePrDescription(options.context);
  const prPlan = await buildPrPlan({
    context: options.context,
    repository: options.repository,
    commitPlan,
    baseBranch: options.baseBranch,
    title: options.title,
    execute: options.execute
  });
  await writePrPlan(options.context, prPlan);

  if (!options.execute) {
    const result: ExecutionResult = {
      status: "dry-run",
      commitHashes: [],
      pushed: false
    };
    await finalizeAgentRunReport({
      context: options.context,
      commitPlan,
      prPlan,
      execution: result
    });
    return result;
  }

  if (!prerequisites.safeForExecution || !prerequisites.ghAuthenticated) {
    throw new Error(
      [
        ...prerequisites.errors,
        ...prerequisites.executionBlockers,
        ...(!prerequisites.ghAuthenticated
          ? ["Authenticated GitHub CLI is required by execute-commit-and-pr.ts."]
          : [])
      ].join("\n")
    );
  }

  const commitHashes: string[] = [];
  let pushed = false;
  try {
    for (const commit of commitPlan.commits) {
      await runGit(options.repository, ["add", "--", ...commit.files]);
      const staged = (
        await runGit(options.repository, ["diff", "--cached", "--name-only"])
      ).stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map(normalizePath)
        .sort();
      const expected = [...commit.files].map(normalizePath).sort();
      if (JSON.stringify(staged) !== JSON.stringify(expected)) {
        throw new Error(
          `Staged files do not match commit plan. Expected: ${expected.join(", ")}. Staged: ${staged.join(", ")}.`
        );
      }
      const [subject, ...body] = commit.message.split("\n");
      const commitArgs = ["commit", "--no-gpg-sign", "-m", subject ?? ""];
      if (body.length > 0) {
        commitArgs.push("-m", body.join("\n"));
      }
      await runGit(options.repository, commitArgs);
      commitHashes.push(
        (await runGit(options.repository, ["rev-parse", "HEAD"])).stdout.trim()
      );
    }
    await runGitNonInteractive(options.repository, [
      "push",
      "-u",
      "origin",
      options.context.branchName
    ]);
    pushed = true;
    const ghResult = await execFileAsync(
      "gh",
      [
        "pr",
        "create",
        "--base",
        prPlan.baseBranch,
        "--head",
        options.context.branchName,
        "--title",
        prPlan.prTitle,
        "--body-file",
        path.join(options.context.runDir, "pr-description.md")
      ],
      {
        cwd: options.repository,
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024,
        env: {
          ...process.env,
          GH_PROMPT_DISABLED: "1"
        }
      }
    );
    const prUrl = ghResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^https:\/\/github\.com\/.+\/pull\/\d+/.test(line));
    if (!prUrl) {
      throw new Error("gh pr create did not return a PR URL.");
    }
    const result: ExecutionResult = {
      status: "created",
      commitHashes,
      pushed,
      prUrl
    };
    await finalizeAgentRunReport({
      context: options.context,
      commitPlan,
      prPlan,
      execution: result
    });
    return result;
  } catch (error) {
    const result: ExecutionResult = {
      status: "failed",
      commitHashes,
      pushed,
      error: error instanceof Error ? error.message : String(error)
    };
    await finalizeAgentRunReport({
      context: options.context,
      commitPlan,
      prPlan,
      execution: result
    });
    throw error;
  }
}
