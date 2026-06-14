import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import { extractMarkdownSection, markdownList } from "../../../shared/core/markdown.js";
import { pathExists, writeTextFile } from "../../../shared/core/fs.js";
import type { BrowserChangedFile, BrowserContext } from "./browser-context.js";

const resourcesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../resources"
);

export type BrowserVerificationStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "approval-required";

export type BrowserExecutionPath =
  | "playwright-mcp-agent"
  | "skipped"
  | "approval-required";

export type BrowserNeedDecision = {
  needed: boolean;
  reason: string;
  targetArea: string;
};

export type BrowserScenarioPlan = BrowserNeedDecision & {
  ticketKey: string;
  preconditions: string;
  startUrl: string;
  scenarioName: string;
  steps: string[];
  expectedResults: string[];
  screenshotPoints: string[];
  requiredTestAccountOrMockData: string;
  nonGoals: string[];
  executionReadiness: string;
};

export type BrowserReportInput = {
  status?: BrowserVerificationStatus;
  mcpNotes?: string;
  targetUrl?: string;
  approveStaging: boolean;
};

export type BrowserVerificationReport = {
  ticketKey: string;
  status: BrowserVerificationStatus;
  executionPath: BrowserExecutionPath;
  needed: boolean;
  reason: string;
  scenarioSummary: string;
  mcpAgentModeSummary: string;
  result: string;
  skippedReason: string;
  approvalRequired: string;
  prExecutionImpact: string;
};

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
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

function textContext(context: BrowserContext): string {
  return [
    context.inputs.taskSpec,
    context.inputs.testPlan,
    context.inputs.userImplementationIntent ?? "",
    context.inputs.implementationSummary,
    context.inputs.storybookReport ?? ""
  ].join("\n");
}

function isDocsFile(filePath: string): boolean {
  return /\.(md|mdx|txt|rst)$/i.test(filePath) ||
    /(^|\/)(README|CHANGELOG|CONTRIBUTING)(?:\.[^/]+)?$/i.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(filePath) ||
    /(^|\/)(__tests__|tests)\//.test(filePath);
}

function isBuildConfigFile(filePath: string): boolean {
  return /(^|\/)(?:package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|tsconfig(?:\.[^/]+)?\.json|(?:vite|vitest|jest|playwright|webpack|rollup|next|babel|eslint|biome)\.config\.[^/]+)$/.test(
    filePath
  );
}

function isUiFile(file: BrowserChangedFile): boolean {
  const filePath = normalizePath(file.path);
  return (
    /\.(tsx|jsx|vue|svelte|css|scss|less)$/i.test(filePath) ||
    /(^|\/)(app|pages|routes|components|features|ui)\//.test(filePath)
  );
}

function routeFromPath(filePath: string): string | undefined {
  const normalized = normalizePath(filePath);
  const appMatch = normalized.match(/^(?:src\/)?app\/(.+?)\/page\.[^/]+$/);
  if (appMatch?.[1]) {
    return `/${appMatch[1]
      .replace(/\([^)]*\)\//g, "")
      .replace(/\[[^/]+\]/g, ":param")}`.replace(/\/index$/, "");
  }
  const pagesMatch = normalized.match(/^(?:src\/)?pages\/(.+?)\.[^/]+$/);
  if (pagesMatch?.[1]) {
    const route = pagesMatch[1].replace(/\[[^/]+\]/g, ":param");
    return route === "index" ? "/" : `/${route}`;
  }
  return undefined;
}

function startUrlFor(context: BrowserContext, explicitTarget?: string): string {
  if (explicitTarget) {
    return explicitTarget;
  }
  const routeFromChangedFiles = context.inputs.changedFilesArtifact.changedFiles
    .map((file) => routeFromPath(file.path))
    .find(Boolean);
  if (routeFromChangedFiles) {
    return routeFromChangedFiles;
  }
  const routeFromText = [
    ...textContext(context).matchAll(/(?:^|[\s(["'`])\/([A-Za-z0-9][A-Za-z0-9/_:.-]*)/g)
  ]
    .map((match) => `/${match[1]}`.replace(/[),.;:!?]+$/, ""))
    .find((candidate) => !/\.[a-z0-9]+$/i.test(candidate));
  return routeFromText ?? "approval-required: target URL needed";
}

function expectedResults(context: BrowserContext): string[] {
  const sections = [
    extractMarkdownSection(context.inputs.taskSpec, "Acceptance Criteria"),
    extractMarkdownSection(context.inputs.taskSpec, "Expected Behavior"),
    extractMarkdownSection(context.inputs.testPlan, "Expected Results"),
    extractMarkdownSection(context.inputs.implementationSummary, "What Changed")
  ].filter(Boolean);
  const results = sections
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => Boolean(line) && !/^#+\s+/.test(line));
  return [...new Set(results)].slice(0, 2);
}

function requiresAccountOrMock(context: BrowserContext): boolean {
  return /\b(login|logout|auth|session|signup|payment|checkout|order|admin|permission|role|로그인|로그아웃|가입|결제|주문|권한|관리자)\b/i.test(
    textContext(context)
  );
}

function accountOrMockData(context: BrowserContext): string {
  if (requiresAccountOrMock(context)) {
    return "Approved non-production test account, mock auth/session, or seeded test data may be required.";
  }
  return "No special test account or mock data was inferred.";
}

export function decideBrowserVerificationNeeded(
  context: BrowserContext
): BrowserNeedDecision {
  const changedFiles = context.inputs.changedFilesArtifact.changedFiles.map((file) =>
    normalizePath(file.path)
  );
  const allNonUi =
    changedFiles.length > 0 &&
    changedFiles.every(
      (filePath) =>
        isDocsFile(filePath) || isTestFile(filePath) || isBuildConfigFile(filePath)
    );
  if (allNonUi) {
    return {
      needed: false,
      reason:
        "Changed files are docs, tests, build config, or non-UI-only artifacts.",
      targetArea: changedFiles.map((filePath) => `\`${filePath}\``).join(", ")
    };
  }

  const uiFiles = context.inputs.changedFilesArtifact.changedFiles.filter(isUiFile);
  if (uiFiles.length > 0) {
    const uiTargets = uiFiles
      .map((file) => `\`${normalizePath(file.path)}\``)
      .join(", ");
    const changeNotes = uiFiles
      .map((file) => file.reason?.trim())
      .filter((reason): reason is string => Boolean(reason))
      .join("; ");
    return {
      needed: true,
      reason: [
        `Changed files include browser-visible UI, routing, component, or style paths: ${uiTargets}.`,
        changeNotes ? `Change notes: ${changeNotes}` : undefined
      ]
        .filter(Boolean)
        .join(" "),
      targetArea: uiTargets
    };
  }

  const contextText = textContext(context);
  const matched = contextText.match(
    /\b(ui|route|routing|page|form|submit|login|logout|permission|payment|order|signup|modal|toast|error message|browser|사용자|폼|제출|로그인|로그아웃|권한|결제|주문|가입|모달|토스트|에러|라우팅)\b/i
  );
  if (matched) {
    return {
      needed: true,
      reason: `Ticket artifacts mention browser-relevant behavior: ${matched[0]}.`,
      targetArea:
        firstMeaningfulLine(extractMarkdownSection(context.inputs.taskSpec, "Objective")) ??
        "Browser-visible ticket flow"
    };
  }

  const storybookStatus = firstMeaningfulLine(
    extractMarkdownSection(context.inputs.storybookReport ?? "", "Storybook Status")
  )?.toLowerCase();
  if (storybookStatus === "skipped" || storybookStatus === "approval-required") {
    return {
      needed: true,
      reason: `Storybook verification was ${storybookStatus}, so browser scenario verification is recommended.`,
      targetArea: "Component states not fully covered by Storybook"
    };
  }

  return {
    needed: false,
    reason:
      "No UI/browser interaction change was detected from changed files or artifacts.",
    targetArea: changedFiles.map((filePath) => `\`${filePath}\``).join(", ") || "None"
  };
}

export function createBrowserScenarioPlan(options: {
  context: BrowserContext;
  targetUrl?: string;
}): BrowserScenarioPlan {
  const decision = decideBrowserVerificationNeeded(options.context);
  const objective =
    firstMeaningfulLine(extractMarkdownSection(options.context.inputs.taskSpec, "Objective")) ??
    "Verify the browser-visible ticket flow";
  const expected = expectedResults(options.context);
  const startUrl = startUrlFor(options.context, options.targetUrl);
  const needsExternalData = requiresAccountOrMock(options.context);
  return {
    ticketKey: options.context.ticketKey,
    ...decision,
    preconditions:
      "Use localhost, 127.0.0.1, local preview, or explicitly approved staging only.",
    startUrl,
    scenarioName: decision.needed ? objective : "Browser verification not required",
    steps: decision.needed
      ? [
          `Open ${startUrl}.`,
          "Perform the user action described in task-spec.md and test-plan.md.",
          "Observe the expected UI state, route, message, modal, toast, or form result."
        ]
      : [
          "No browser scenario is required for the detected change type.",
          "Record skipped status in browser-verification-report.md.",
          "Keep PR execution gated by explicit skip approval if browser verification is required by reviewer policy."
        ],
    expectedResults:
      expected.length > 0
        ? expected
        : ["The browser-visible behavior matches the task spec.", "No unrelated UI regression is observed."],
    screenshotPoints: decision.needed
      ? ["Initial target state", "Final state after the ticket-specific interaction"]
      : ["None"],
    requiredTestAccountOrMockData: accountOrMockData(options.context),
    nonGoals: [
      "Do not access production.",
      "Do not perform real payment, real email, destructive data mutation, account deletion, permission changes, or secret reads.",
      "Do not implement a local MCP client, install Playwright, run project Playwright fallback, commit, push, or create a PR."
    ],
    executionReadiness: !decision.needed
      ? "skipped-ready"
      : startUrl.startsWith("approval-required") || needsExternalData
        ? "approval-required"
        : "ready-for-playwright-mcp-agent"
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

export function renderBrowserScenarioPlan(plan: BrowserScenarioPlan): string {
  return `# Browser Scenario Plan
## Ticket
${plan.ticketKey}
## Browser Verification Needed
${String(plan.needed)}
## Reason
${plan.reason}
## Target Area
${plan.targetArea}
## Preconditions
${plan.preconditions}
## Start URL
${plan.startUrl}
## Scenarios
### Scenario 1. ${plan.scenarioName}
Steps:
1. ${plan.steps[0] ?? "Open the target URL."}
2. ${plan.steps[1] ?? "Perform the ticket-specific interaction."}
3. ${plan.steps[2] ?? "Observe the expected result."}
Expected Results:
- ${plan.expectedResults[0] ?? "The browser-visible behavior matches the task spec."}
- ${plan.expectedResults[1] ?? "No unrelated UI regression is observed."}
Screenshots:
- ${plan.screenshotPoints.join(", ")}
## Required Test Account or Mock Data
${plan.requiredTestAccountOrMockData}
## Non-goals
${markdownList(plan.nonGoals)}
## Execution Readiness
${plan.executionReadiness}
`;
}

export async function writeBrowserScenarioPlan(options: {
  context: BrowserContext;
  targetUrl?: string;
}): Promise<BrowserScenarioPlan> {
  const plan = createBrowserScenarioPlan(options);
  await writeTextFile(
    options.context.runDir,
    "browser-scenario-plan.md",
    renderBrowserScenarioPlan(plan)
  );
  return plan;
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isStagingHost(hostname: string): boolean {
  return (
    /\b(staging|stage|preview|test|dev)\b/i.test(hostname) ||
    /\.vercel\.app$/i.test(hostname) ||
    /\.netlify\.app$/i.test(hostname)
  );
}

export function targetSafety(targetUrl?: string, approveStaging = false): {
  allowed: boolean;
  status: BrowserVerificationStatus;
  reason: string;
} {
  if (!targetUrl) {
    return {
      allowed: false,
      status: "approval-required",
      reason: "Target URL is required before browser MCP verification."
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      allowed: false,
      status: "approval-required",
      reason: `Invalid target URL: ${targetUrl}`
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      allowed: false,
      status: "failed",
      reason: "Only http and https browser targets are allowed."
    };
  }
  if (isLocalHost(parsed.hostname)) {
    return { allowed: true, status: "passed", reason: "Local target is allowed." };
  }
  if (isStagingHost(parsed.hostname)) {
    return approveStaging
      ? {
          allowed: true,
          status: "passed",
          reason: "Staging or preview target was explicitly approved."
        }
      : {
          allowed: false,
          status: "approval-required",
          reason: "Staging or preview target requires --approve-staging."
        };
  }
  return {
    allowed: false,
    status: "failed",
    reason: "Production or unclassified external browser targets are forbidden."
  };
}

function prExecutionImpact(status: BrowserVerificationStatus): string {
  const values: Record<BrowserVerificationStatus, string> = {
    passed: "PR execution may continue after remaining required checks.",
    failed: "PR execution must stop until browser scenario issues are resolved.",
    "approval-required":
      "PR execution must stop until user provides target URL, test account, or approval.",
    skipped:
      "PR execution requires user confirmation if browser verification is required for this ticket."
  };
  return values[status];
}

function reportStatus(options: {
  plan: BrowserScenarioPlan;
  requestedStatus?: BrowserVerificationStatus;
  targetUrl?: string;
  approveStaging: boolean;
}): {
  status: BrowserVerificationStatus;
  executionPath: BrowserExecutionPath;
  result: string;
  skippedReason: string;
  approvalRequired: string;
} {
  if (options.targetUrl) {
    const safety = targetSafety(options.targetUrl, options.approveStaging);
    if (!safety.allowed) {
      return {
        status: safety.status,
        executionPath: "approval-required",
        result: safety.status === "failed" ? safety.reason : "Not executed.",
        skippedReason: "",
        approvalRequired:
          safety.status === "approval-required" ? safety.reason : ""
      };
    }
  }

  if (options.requestedStatus === "passed" || options.requestedStatus === "failed") {
    return {
      status: options.requestedStatus,
      executionPath: "playwright-mcp-agent",
      result:
        options.requestedStatus === "passed"
          ? "Codex agent recorded passed Playwright MCP verification."
          : "Codex agent recorded failed Playwright MCP verification.",
      skippedReason: "",
      approvalRequired: ""
    };
  }

  if (options.requestedStatus === "skipped") {
    return {
      status: "skipped",
      executionPath: "skipped",
      result: "Not executed.",
      skippedReason: "Browser verification was explicitly recorded as skipped.",
      approvalRequired: ""
    };
  }

  if (options.requestedStatus === "approval-required") {
    return {
      status: "approval-required",
      executionPath: "approval-required",
      result: "Not executed.",
      skippedReason: "",
      approvalRequired:
        "User input or approval is required before browser MCP verification."
    };
  }

  if (!options.plan.needed) {
    return {
      status: "skipped",
      executionPath: "skipped",
      result: "Not executed.",
      skippedReason: options.plan.reason,
      approvalRequired: ""
    };
  }

  if (options.plan.executionReadiness === "approval-required") {
    return {
      status: "approval-required",
      executionPath: "approval-required",
      result: "Not executed.",
      skippedReason: "",
      approvalRequired:
        "Target URL, approved test account/mock data, or staging approval is required."
    };
  }

  return {
    status: "approval-required",
    executionPath: "approval-required",
    result: "Not executed by local TypeScript script.",
    skippedReason: "",
    approvalRequired:
      "Use Codex Playwright MCP agent mode to execute the scenario, then re-run with --status passed or --status failed and --mcp-notes."
  };
}

function scenarioSummary(plan: BrowserScenarioPlan): string {
  return plan.needed
    ? `${plan.scenarioName}: ${plan.steps.length} step(s), start URL ${plan.startUrl}.`
    : "Browser verification was not required for the detected change type.";
}

async function replaceOrAddMarkdownSection(
  filePath: string,
  heading: string,
  body: string,
  aliases: string[] = []
): Promise<void> {
  const existing = (await pathExists(filePath))
    ? await readFile(filePath, "utf8")
    : "# Agent Run Report\n";
  const lines = existing.trimEnd().split(/\r?\n/);
  const headings = [heading, ...aliases].map((item) => `## ${item}`);
  const start = lines.findIndex((line) => headings.includes(line.trim()));
  const updated =
    start === -1
      ? `${existing.trimEnd()}\n\n## ${heading}\n\n${body.trim()}\n`
      : (() => {
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
        })();
  await writeFile(filePath, updated, "utf8");
}

async function updateBrowserReports(options: {
  context: BrowserContext;
  report: BrowserVerificationReport;
}): Promise<void> {
  const prPlanPath = path.join(options.context.runDir, "pr-plan.md");
  if (await pathExists(prPlanPath)) {
    await replaceOrAddMarkdownSection(
      prPlanPath,
      "Browser Verification Status",
      options.report.status,
      ["Browser Scenario Status"]
    );
    await replaceOrAddMarkdownSection(
      prPlanPath,
      "Browser Verification PR Gate",
      options.report.prExecutionImpact,
      ["Browser Scenario PR Gate"]
    );
  }

  const body = `- Browser Verification Status: ${options.report.status}
- Updated at: ${new Date().toISOString()}
- Execution Path: ${options.report.executionPath}
- Browser Verification Needed: ${String(options.report.needed)}
- Reason: ${options.report.reason}

### PR Execution Impact

${options.report.prExecutionImpact}

### Browser Verification Boundary

- No commit, push, PR, GitHub Actions check, production access, Jira mutation, payment, email, destructive data change, unapproved staging access, unapproved test account use, secret read, local MCP client, Playwright installation, or project Playwright fallback runner was performed.`;
  await updateAgentRunReportSection(
    options.context.runDir,
    "Browser Scenario Verification",
    body
  );
}

export async function generateBrowserVerificationReport(options: {
  context: BrowserContext;
  status?: BrowserVerificationStatus;
  mcpNotes?: string;
  targetUrl?: string;
  approveStaging: boolean;
}): Promise<BrowserVerificationReport> {
  const plan = await writeBrowserScenarioPlan({
    context: options.context,
    targetUrl: options.targetUrl
  });
  const status = reportStatus({
    plan,
    requestedStatus: options.status,
    targetUrl: options.targetUrl,
    approveStaging: options.approveStaging
  });
  const mcpAgentModeSummary =
    options.mcpNotes?.trim() ||
    "Local TypeScript scripts do not call Playwright MCP. If Codex runtime exposes Playwright MCP, the agent should read browser-scenario-plan.md and perform the scenario directly.";
  const report: BrowserVerificationReport = {
    ticketKey: options.context.ticketKey,
    status: status.status,
    executionPath: status.executionPath,
    needed: plan.needed,
    reason: plan.reason,
    scenarioSummary: scenarioSummary(plan),
    mcpAgentModeSummary,
    result: status.result,
    skippedReason: status.skippedReason,
    approvalRequired: status.approvalRequired,
    prExecutionImpact: prExecutionImpact(status.status)
  };
  const content = await renderTemplate("browser-verification-report-template.md", {
    ticketKey: report.ticketKey,
    status: report.status,
    executionPath: report.executionPath,
    needed: String(report.needed),
    reason: report.reason,
    scenarioSummary: report.scenarioSummary,
    mcpAgentModeSummary: report.mcpAgentModeSummary,
    result: report.result,
    skippedReason: report.skippedReason || "None",
    approvalRequired: report.approvalRequired || "None",
    prExecutionImpact: report.prExecutionImpact
  });
  await writeTextFile(options.context.runDir, "browser-verification-report.md", content);
  await updateBrowserReports({ context: options.context, report });
  return report;
}
