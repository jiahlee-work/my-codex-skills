import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import { pathExists, readJsonFile, writeJsonFile, writeTextFile } from "../../../shared/core/fs.js";
import type { VerificationContext } from "./verification-context.js";

export type VerificationMode = "light" | "full";
export type VerificationStep = "lint" | "typecheck" | "test" | "build";
export type VerificationCommandStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked";
export type VerificationResult = "passed" | "failed" | "partial" | "blocked";
export type FailureClassification =
  | "implementation_error"
  | "test_error"
  | "type_error"
  | "lint_error"
  | "build_error"
  | "environment_error"
  | "missing_dependency"
  | "missing_config"
  | "unknown";

export type VerificationModeDecision = {
  selectedMode: VerificationMode;
  recommendedMode: VerificationMode;
  source: "user" | "automatic";
  riskSignals: string[];
  warnings: string[];
};

export type ResolvedCommand = {
  step: VerificationStep;
  command?: string;
  executable?: string;
  args?: string[];
  available: boolean;
  skippedReason?: string;
};

export type OptionalVerificationCommand = {
  name: string;
  command: string;
  reason: string;
};

export type VerificationCommandResolution = {
  repository: string;
  packageManager: "pnpm" | "npm" | "yarn";
  packageManagerReason: string;
  mode: VerificationMode;
  commands: ResolvedCommand[];
  optionalCommands: OptionalVerificationCommand[];
};

export type FailureAnalysis = {
  failedStep: VerificationStep;
  failedCommand: string;
  failureLocation: string;
  errorSummary: string;
  possibleCause: string;
  responsibility: "requirements" | "implementation" | "environment" | "unknown";
  classification: FailureClassification;
  retryAllowed: boolean;
  retryReason: string;
  recommendedNextAction: string;
};

export type VerificationAttempt = {
  attempt: number;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  failureAnalysis?: FailureAnalysis;
};

export type VerificationCommandResult = {
  step: VerificationStep;
  command?: string;
  status: VerificationCommandStatus;
  exitCode?: number;
  durationMs: number;
  log?: string;
  skippedReason?: string;
  attempts: VerificationAttempt[];
};

export type VerificationSummary = {
  ticketKey: string;
  repository: string;
  agentRun: string;
  verificationMode: VerificationMode;
  recommendedMode: VerificationMode;
  modeSource: "user" | "automatic";
  riskSignals: string[];
  warnings: string[];
  continueOnFailure: boolean;
  timeoutMs: number;
  startedAt: string;
  completedAt: string;
  commands: VerificationCommandResult[];
  optionalCommands: OptionalVerificationCommand[];
  result: VerificationResult;
};

type PackageJson = {
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillResources = path.resolve(
  scriptDir,
  "../resources"
);
const maxAttempts = 3;
const maxCapturedLogCharacters = 250_000;

function commandForScript(
  packageManager: VerificationCommandResolution["packageManager"],
  scriptName: string
): { command: string; executable: string; args: string[] } {
  if (packageManager === "npm") {
    return {
      command: scriptName === "test" ? "npm test" : `npm run ${scriptName}`,
      executable: "npm",
      args: scriptName === "test" ? ["test"] : ["run", scriptName]
    };
  }
  return {
    command: `${packageManager} ${scriptName}`,
    executable: packageManager,
    args: [scriptName]
  };
}

async function detectPackageManager(
  repository: string,
  packageJson: PackageJson
): Promise<{
  packageManager: VerificationCommandResolution["packageManager"];
  reason: string;
}> {
  const declared = packageJson.packageManager?.split("@")[0];
  if (declared === "pnpm" || declared === "npm" || declared === "yarn") {
    return {
      packageManager: declared,
      reason: `package.json packageManager declares ${declared}.`
    };
  }
  const lockFiles: Array<[
    string,
    VerificationCommandResolution["packageManager"]
  ]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["package-lock.json", "npm"],
    ["yarn.lock", "yarn"]
  ];
  for (const [fileName, packageManager] of lockFiles) {
    if (await pathExists(path.join(repository, fileName))) {
      return { packageManager, reason: `${fileName} was detected.` };
    }
  }
  return {
    packageManager: "pnpm",
    reason: "No supported packageManager field or lockfile was found; defaulted to pnpm."
  };
}

async function hasTypeScriptConfig(repository: string): Promise<boolean> {
  const entries = await readdir(repository, { withFileTypes: true }).catch(() => []);
  return entries.some(
    (entry) =>
      entry.isFile() &&
      (entry.name === "tsconfig.json" ||
        /^tsconfig\.[^.]+\.json$/.test(entry.name))
  );
}

async function detectPlaywrightConfiguration(
  repository: string,
  packageJson: PackageJson,
  packageManager: VerificationCommandResolution["packageManager"]
): Promise<OptionalVerificationCommand[]> {
  const optional: OptionalVerificationCommand[] = [];
  if (packageJson.scripts?.["test:e2e"]) {
    optional.push({
      name: "test:e2e",
      command: commandForScript(packageManager, "test:e2e").command,
      reason: "Detected for Browser Scenario Verification; not executed during local verification."
    });
  }
  const dependencyNames = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const entries = await readdir(repository, { withFileTypes: true }).catch(() => []);
  const hasConfig = entries.some(
    (entry) => entry.isFile() && /^playwright\.config\.[^.]+$/.test(entry.name)
  );
  const hasDependency = Boolean(
    dependencyNames["@playwright/test"] || dependencyNames.playwright
  );
  const scriptRunsPlaywright = Object.entries(packageJson.scripts ?? {}).some(
    ([name, command]) =>
      name !== "test:e2e" && /\bplaywright\s+test\b/.test(command)
  );
  if (
    optional.length === 0 &&
    (scriptRunsPlaywright || (hasConfig && hasDependency))
  ) {
    const command =
      packageManager === "npm"
        ? "npx playwright test"
        : `${packageManager} playwright test`;
    optional.push({
      name: "playwright",
      command,
      reason: "Playwright is configured, but browser verification is deferred to Browser Scenario Verification."
    });
  }
  return optional;
}

export async function resolveVerificationCommands(options: {
  repository: string;
  mode: VerificationMode;
}): Promise<VerificationCommandResolution> {
  const packagePath = path.join(options.repository, "package.json");
  const packageJson: PackageJson = (await pathExists(packagePath))
    ? await readJsonFile<PackageJson>(packagePath)
    : {};
  const manager = await detectPackageManager(options.repository, packageJson);
  const commands: ResolvedCommand[] = [];

  for (const step of ["lint", "typecheck", "test", "build"] as const) {
    if (step === "build" && options.mode === "light") {
      commands.push({
        step,
        available: false,
        skippedReason: "Light verification mode excludes build."
      });
      continue;
    }
    if (packageJson.scripts?.[step]) {
      commands.push({
        step,
        available: true,
        ...commandForScript(manager.packageManager, step)
      });
      continue;
    }
    if (step === "typecheck" && (await hasTypeScriptConfig(options.repository))) {
      commands.push({
        step,
        available: true,
        command: "tsc --noEmit",
        executable: "tsc",
        args: ["--noEmit"]
      });
      continue;
    }
    commands.push({
      step,
      available: false,
      skippedReason: packageJson.scripts
        ? `package.json has no ${step} script${
            step === "typecheck" ? " and no TypeScript config fallback is available" : ""
          }.`
        : "package.json was not found."
    });
  }

  return {
    repository: options.repository,
    packageManager: manager.packageManager,
    packageManagerReason: manager.reason,
    mode: options.mode,
    commands,
    optionalCommands:
      options.mode === "full"
        ? await detectPlaywrightConfiguration(
            options.repository,
            packageJson,
            manager.packageManager
          )
        : []
  };
}

function compactLog(value: string): string {
  return value.length <= maxCapturedLogCharacters
    ? value
    : value.slice(value.length - maxCapturedLogCharacters);
}

function failureLocation(log: string): string {
  const patterns = [
    /(?:^|\n)\s*(?:FAIL\s+)?([A-Za-z0-9_@./\\-]+\.(?:test|spec)\.[cm]?[jt]sx?)(?::(\d+)(?::(\d+))?)?/i,
    /(?:^|\n)\s*([A-Za-z0-9_@./\\-]+\.[cm]?[jt]sx?):(\d+):(\d+)/,
    /(?:^|\n)\s*at\s+([^\n]+)/
  ];
  for (const pattern of patterns) {
    const match = log.match(pattern);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join(":");
    }
  }
  return "Not identified from the log.";
}

function firstErrorLines(log: string): string {
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("$ ") &&
        !line.startsWith("[ELIFECYCLE]") &&
        !line.startsWith("[WARN]") &&
        /\b(error|failed|failure|cannot|missing|timeout|timed out|not found|unexpected)\b/i.test(
          line
        )
    )
    .slice(0, 4);
  return lines.join(" ") || "The command exited with a non-zero status.";
}

function classificationFor(
  step: VerificationStep,
  log: string
): FailureClassification {
  if (
    /\b(command not found|cannot find (?:module|package)|module not found|ERR_MODULE_NOT_FOUND|could not resolve dependency)\b/i.test(
      log
    )
  ) {
    return "missing_dependency";
  }
  if (
    /\b(config(?:uration)? (?:file )?(?:not found|missing)|no inputs were found in config|could not find a configuration)\b/i.test(
      log
    )
  ) {
    return "missing_config";
  }
  if (
    /\b(ECONNREFUSED|ECONNRESET|ENOTFOUND|network|secret|environment variable|permission denied|EACCES|out of memory|ENOMEM)\b/i.test(
      log
    )
  ) {
    return "environment_error";
  }
  const stepClassifications: Record<VerificationStep, FailureClassification> = {
    lint: "lint_error",
    typecheck: "type_error",
    test: "test_error",
    build: "build_error"
  };
  return stepClassifications[step];
}

export function analyzeVerificationFailure(options: {
  step: VerificationStep;
  command: string;
  log: string;
  timedOut?: boolean;
}): FailureAnalysis {
  const analysisLog = options.log
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^Timed out:\s*(?:no|false)$/i.test(line.trim()) &&
        !/^Failure analysis before retry decision:$/i.test(line.trim())
    )
    .join("\n");
  const classification = classificationFor(options.step, analysisLog);
  const externalFailure =
    /\b(ECONNREFUSED|ENOTFOUND|network|external service|secret|environment variable)\b/i.test(
      analysisLog
    );
  const dependencyOrConfig =
    classification === "missing_dependency" || classification === "missing_config";
  const requirementProblem =
    /\b(ambiguous requirement|unclear requirement|requirements? unclear)\b/i.test(
      analysisLog
    );
  const largeRefactor = /\b(large refactor|major refactor|architectural change)\b/i.test(
    analysisLog
  );
  const packageChangeNeeded =
    /\b(update|modify|change)\s+(package\.json|lockfile|pnpm-lock|package-lock|yarn\.lock)\b/i.test(
      analysisLog
    );
  const transient =
    Boolean(options.timedOut) ||
    /\b(EAGAIN|EBUSY|worker exited|stale cache|cache corruption|flaky|intermittent|snapshot|timed out|timeout)\b/i.test(
      analysisLog
    );
  const typeErrors = analysisLog.match(/\berror TS\d+:/g)?.length ?? 0;
  const smallTypeError =
    options.step === "typecheck" &&
    typeErrors > 0 &&
    typeErrors <= 3 &&
    !dependencyOrConfig;
  const retryAllowed =
    !externalFailure &&
    !dependencyOrConfig &&
    !requirementProblem &&
    !largeRefactor &&
    !packageChangeNeeded &&
    (transient || smallTypeError);
  const responsibility: FailureAnalysis["responsibility"] = requirementProblem
    ? "requirements"
    : classification === "environment_error" ||
        classification === "missing_dependency" ||
        classification === "missing_config"
      ? "environment"
      : classification === "unknown"
        ? "unknown"
        : "implementation";
  const causeByClassification: Record<FailureClassification, string> = {
    implementation_error: "The implementation does not satisfy the expected behavior.",
    test_error: transient
      ? "The test failure may be transient, snapshot-related, or caused by test state."
      : "A test assertion, fixture, or implementation behavior failed.",
    type_error: "The changed code or its consumers do not satisfy TypeScript constraints.",
    lint_error: "The changed code violates the configured lint rules.",
    build_error: "The production build could not compile or bundle the current changes.",
    environment_error: "The local environment, network, secret, or process resources caused the failure.",
    missing_dependency: "A required executable, module, or package is unavailable.",
    missing_config: "A required project configuration is missing or cannot be loaded.",
    unknown: "The log does not contain enough information for deterministic classification."
  };

  return {
    failedStep: options.step,
    failedCommand: options.command,
    failureLocation: failureLocation(analysisLog),
    errorSummary: firstErrorLines(analysisLog),
    possibleCause: causeByClassification[classification],
    responsibility,
    classification,
    retryAllowed,
    retryReason: retryAllowed
      ? transient
        ? "The log contains a transient, timeout, cache, worker, or snapshot signal."
        : "The log contains a small number of localized TypeScript errors."
      : "Retry is unlikely to help without code, dependency, configuration, requirement, or environment changes.",
    recommendedNextAction: retryAllowed
      ? "Retry the same command without modifying code, up to the local verification attempt limit."
      : responsibility === "environment"
        ? "Restore the required local environment, dependency, configuration, secret, or service before rerunning local verification."
        : responsibility === "requirements"
          ? "Clarify the requirement before changing implementation or tests."
          : "Review the failure and make the smallest ticket-scoped fix in a separate implementation step, then rerun local verification."
  };
}

async function runCommandAttempt(options: {
  repository: string;
  command: ResolvedCommand;
  logPath: string;
  attempt: number;
  timeoutMs: number;
}): Promise<{
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
  capturedLog: string;
}> {
  const startedAt = Date.now();
  const stream = createWriteStream(options.logPath, {
    flags: options.attempt === 1 ? "w" : "a"
  });
  stream.write(
    `${options.attempt === 1 ? "" : "\n"}=== Attempt ${options.attempt} ===\nCommand: ${options.command.command}\nStarted: ${new Date(startedAt).toISOString()}\n\n`
  );
  let capturedLog = "";
  const localBin = path.join(options.repository, "node_modules", ".bin");
  const child = spawn(
    options.command.executable as string,
    options.command.args ?? [],
    {
      cwd: options.repository,
      env: {
        ...process.env,
        PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ""}`
      },
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  const capture = (chunk: Buffer): void => {
    const text = chunk.toString("utf8");
    capturedLog = compactLog(capturedLog + text);
    stream.write(text);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  let timedOut = false;
  const terminate = (signal: NodeJS.Signals): void => {
    if (process.platform !== "win32" && child.pid) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // The process may already have exited between the timeout and the signal.
      }
    }
    child.kill(signal);
  };
  let forceKillTimer: NodeJS.Timeout | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    terminate("SIGTERM");
    forceKillTimer = setTimeout(() => terminate("SIGKILL"), 2_000);
    forceKillTimer.unref();
  }, options.timeoutMs);

  const exitCode = await new Promise<number>((resolve) => {
    child.on("error", (error) => {
      const message = `${error.name}: ${error.message}\n`;
      capturedLog = compactLog(capturedLog + message);
      stream.write(message);
      resolve(127);
    });
    child.on("close", (code) => resolve(timedOut ? 124 : (code ?? 1)));
  });
  clearTimeout(timer);
  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
  }
  const durationMs = Date.now() - startedAt;
  stream.write(
    `\nFinished: ${new Date().toISOString()}\nExit code: ${exitCode}\nDuration ms: ${durationMs}\nTimed out: ${timedOut ? "yes" : "no"}\n`
  );
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
  return { exitCode, durationMs, timedOut, capturedLog };
}

function resultFor(commands: VerificationCommandResult[]): VerificationResult {
  const ran = commands.filter((command) => command.attempts.length > 0);
  if (commands.some((command) => command.status === "failed")) {
    return "failed";
  }
  if (ran.length === 0) {
    return "blocked";
  }
  if (
    commands.some(
      (command) =>
        command.status !== "passed" &&
        command.skippedReason !== "Light verification mode excludes build."
    )
  ) {
    return "partial";
  }
  return "passed";
}

export async function runVerification(options: {
  context: VerificationContext;
  repository: string;
  decision: VerificationModeDecision;
  continueOnFailure: boolean;
  timeoutMs: number;
}): Promise<VerificationSummary> {
  const startedAt = new Date();
  const resolution = await resolveVerificationCommands({
    repository: options.repository,
    mode: options.decision.selectedMode
  });
  const logsDir = path.join(options.context.runDir, "logs");
  await mkdir(logsDir, { recursive: true });
  const commands: VerificationCommandResult[] = [];
  let previousFailure = false;

  for (const command of resolution.commands) {
    if (!command.available) {
      commands.push({
        step: command.step,
        status: "skipped",
        durationMs: 0,
        skippedReason: command.skippedReason,
        attempts: []
      });
      continue;
    }
    if (previousFailure && !options.continueOnFailure) {
      commands.push({
        step: command.step,
        command: command.command,
        status: "blocked",
        durationMs: 0,
        skippedReason: "A previous verification command failed and --continue-on-failure was not set.",
        attempts: []
      });
      continue;
    }

    const logName = `${command.step}.log`;
    const logPath = path.join(logsDir, logName);
    const attempts: VerificationAttempt[] = [];
    let totalDurationMs = 0;
    let finalExitCode = 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const execution = await runCommandAttempt({
        repository: options.repository,
        command,
        logPath,
        attempt,
        timeoutMs: options.timeoutMs
      });
      totalDurationMs += execution.durationMs;
      finalExitCode = execution.exitCode;
      if (execution.exitCode === 0) {
        attempts.push({
          attempt,
          exitCode: execution.exitCode,
          durationMs: execution.durationMs,
          timedOut: execution.timedOut
        });
        break;
      }
      const analysis = analyzeVerificationFailure({
        step: command.step,
        command: command.command as string,
        log: execution.capturedLog,
        timedOut: execution.timedOut
      });
      attempts.push({
        attempt,
        exitCode: execution.exitCode,
        durationMs: execution.durationMs,
        timedOut: execution.timedOut,
        failureAnalysis: analysis
      });
      await appendFile(
        logPath,
        `\nFailure analysis before retry decision:\n- Classification: ${analysis.classification}\n- Summary: ${analysis.errorSummary}\n- Retry allowed: ${analysis.retryAllowed ? "yes" : "no"}\n- Reason: ${analysis.retryReason}\n`,
        "utf8"
      );
      if (!analysis.retryAllowed || attempt === maxAttempts) {
        break;
      }
    }

    const passed = finalExitCode === 0;
    commands.push({
      step: command.step,
      command: command.command,
      status: passed ? "passed" : "failed",
      exitCode: finalExitCode,
      durationMs: totalDurationMs,
      log: path.posix.join("logs", logName),
      attempts
    });
    if (!passed) {
      previousFailure = true;
    }
  }

  const summary: VerificationSummary = {
    ticketKey: options.context.ticketKey,
    repository: options.repository,
    agentRun: options.context.runDir,
    verificationMode: options.decision.selectedMode,
    recommendedMode: options.decision.recommendedMode,
    modeSource: options.decision.source,
    riskSignals: options.decision.riskSignals,
    warnings: options.decision.warnings,
    continueOnFailure: options.continueOnFailure,
    timeoutMs: options.timeoutMs,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    commands,
    optionalCommands: resolution.optionalCommands,
    result: resultFor(commands)
  };
  await writeJsonFile(logsDir, "verification-summary.json", summary);
  return summary;
}

function markdownList(items: string[], empty = "- None"): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : empty;
}

function duration(value: number): string {
  if (value === 0) {
    return "0 ms";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(2)} s`;
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

function latestFailure(
  summary: VerificationSummary
): {
  result: VerificationCommandResult;
  analysis: FailureAnalysis;
} | undefined {
  for (const result of [...summary.commands].reverse()) {
    const analysis = [...result.attempts]
      .reverse()
      .find((attempt) => attempt.failureAnalysis)?.failureAnalysis;
    if (result.status === "failed" && analysis) {
      return { result, analysis };
    }
  }
  return undefined;
}

export async function generateVerificationReport(
  context: VerificationContext,
  summary: VerificationSummary
): Promise<string> {
  const byStep = new Map(summary.commands.map((command) => [command.step, command]));
  const rowValues = (step: VerificationStep) => {
    const item = byStep.get(step);
    return {
      command: item?.command ?? "not available",
      status: item?.status ?? "skipped",
      duration: duration(item?.durationMs ?? 0),
      log: item?.log ? `[\`${item.log}\`](${item.log})` : "-"
    };
  };
  const lint = rowValues("lint");
  const typecheck = rowValues("typecheck");
  const test = rowValues("test");
  const build = rowValues("build");
  const skipped = summary.commands
    .filter((command) => command.status === "skipped" || command.status === "blocked")
    .map(
      (command) =>
        `\`${command.step}\`: ${command.status}, reason: ${command.skippedReason ?? "not recorded"}`
    );
  const optional = summary.optionalCommands.map(
    (command) => `\`${command.command}\`: ${command.reason}`
  );
  const failures = summary.commands.flatMap((command) =>
    command.attempts.flatMap((attempt) =>
      attempt.failureAnalysis
        ? [
            `\`${command.step}\` attempt ${attempt.attempt}: ${attempt.failureAnalysis.errorSummary} Classification: \`${attempt.failureAnalysis.classification}\`.`
          ]
        : []
    )
  );
  const retries = summary.commands
    .filter((command) => command.attempts.length > 1)
    .map(
      (command) =>
        `\`${command.step}\`: ${command.attempts.length} total attempts, final status ${command.status}.`
    );
  const passed = summary.commands.filter((command) => command.status === "passed").length;
  const failed = summary.commands.filter((command) => command.status === "failed").length;
  const content = await renderTemplate("verification-report-template.md", {
    ticketKey: context.ticketKey,
    verificationMode: `${summary.verificationMode} (recommended: ${summary.recommendedMode}, source: ${summary.modeSource})`,
    summary: [
      `${passed} command(s) passed and ${failed} command(s) failed.`,
      summary.riskSignals.length > 0
        ? `Risk signals: ${summary.riskSignals.join(" ")}`
        : "",
      ...summary.warnings
    ].filter(Boolean).join(" "),
    lintCommand: lint.command,
    lintStatus: lint.status,
    lintDuration: lint.duration,
    lintLog: lint.log,
    typecheckCommand: typecheck.command,
    typecheckStatus: typecheck.status,
    typecheckDuration: typecheck.duration,
    typecheckLog: typecheck.log,
    testCommand: test.command,
    testStatus: test.status,
    testDuration: test.duration,
    testLog: test.log,
    buildCommand: build.command,
    buildStatus: build.status,
    buildDuration: build.duration,
    buildLog: build.log,
    skippedCommands: markdownList([...skipped, ...optional]),
    failureAnalysis: markdownList(failures),
    retrySummary: markdownList(retries),
    result: summary.result
  });
  await writeTextFile(context.runDir, "verification-report.md", content);
  return content;
}

export async function generateFailureReport(
  context: VerificationContext,
  summary: VerificationSummary
): Promise<string | undefined> {
  const failure = latestFailure(summary);
  if (!failure) {
    return undefined;
  }
  const attempts = failure.result.attempts.length;
  const stopReason =
    attempts >= maxAttempts
      ? `The command failed ${attempts} consecutive attempts.`
      : failure.analysis.retryAllowed
        ? "The retry limit or execution policy stopped further attempts."
        : failure.analysis.retryReason;
  const content = await renderTemplate("failure-report-template.md", {
    ticketKey: context.ticketKey,
    failedStep: failure.analysis.failedStep,
    failedCommand: failure.analysis.failedCommand,
    errorSummary: `${failure.analysis.errorSummary}\n\nLocation: ${failure.analysis.failureLocation}`,
    failureClassification: failure.analysis.classification,
    retryAttempts: String(Math.max(0, attempts - 1)),
    stopReason,
    recommendedNextActions: `- ${failure.analysis.recommendedNextAction}`,
    logs: failure.result.log ? `- \`${failure.result.log}\`` : "- None"
  });
  await writeTextFile(context.runDir, "failure-report.md", content);
  return content;
}

export async function readVerificationSummary(
  runDir: string
): Promise<VerificationSummary> {
  const summaryPath = path.join(runDir, "logs", "verification-summary.json");
  if (!(await pathExists(summaryPath))) {
    throw new Error(
      `Verification summary not found: ${summaryPath}. Run run-verification.ts first.`
    );
  }
  return readJsonFile<VerificationSummary>(summaryPath);
}

export async function updateVerificationAgentRunReport(
  context: VerificationContext,
  summary: VerificationSummary
): Promise<void> {
  const artifacts = [
    "verification-report.md",
    ...(summary.result === "failed" ? ["failure-report.md"] : []),
    "logs/verification-summary.json",
    ...summary.commands.flatMap((command) => (command.log ? [command.log] : []))
  ];
  const section = `- Status: ${summary.result}
- Updated at: ${new Date().toISOString()}
- Verification mode: ${summary.verificationMode}
- Recommended mode: ${summary.recommendedMode}
- Commands passed: ${summary.commands.filter((command) => command.status === "passed").length}
- Commands failed: ${summary.commands.filter((command) => command.status === "failed").length}

### Generated Artifacts

${markdownList(artifacts)}

### Local Verification Boundary

- No code, test, dependency, package, lockfile, or configuration changes were made.
- No commit, push, PR, GitHub Actions check, Jira mutation, or Playwright MCP run was performed.
`;
  await updateAgentRunReportSection(context.runDir, "Local Verification", section);
}

export async function generateVerificationReports(
  context: VerificationContext,
  summary: VerificationSummary
): Promise<void> {
  await generateVerificationReport(context, summary);
  if (summary.result === "failed") {
    await generateFailureReport(context, summary);
  } else {
    const failurePath = path.join(context.runDir, "failure-report.md");
    if (await pathExists(failurePath)) {
      const failureStat = await stat(failurePath);
      const summaryStat = await stat(
        path.join(context.runDir, "logs", "verification-summary.json")
      );
      if (failureStat.mtimeMs < summaryStat.mtimeMs) {
        await unlink(failurePath);
      }
    }
  }
  await updateVerificationAgentRunReport(context, summary);
}

export async function analyzeLatestVerificationFailure(options: {
  context: VerificationContext;
  summary: VerificationSummary;
}): Promise<FailureAnalysis> {
  const failed = [...options.summary.commands]
    .reverse()
    .find((command) => command.status === "failed" && command.log);
  if (!failed?.log || !failed.command) {
    throw new Error("No failed verification command with a log was found.");
  }
  const completeLog = await readFile(
    path.join(options.context.runDir, failed.log),
    "utf8"
  );
  const lastAttemptLog = completeLog.split(/^=== Attempt \d+ ===$/m).at(-1) ?? completeLog;
  const log = lastAttemptLog.split("\nFailure analysis before retry decision:")[0] ?? lastAttemptLog;
  const lastAttempt = failed.attempts.at(-1);
  const analysis = analyzeVerificationFailure({
    step: failed.step,
    command: failed.command,
    log,
    timedOut: lastAttempt?.timedOut
  });
  if (lastAttempt) {
    lastAttempt.failureAnalysis = analysis;
  }
  await writeJsonFile(
    path.join(options.context.runDir, "logs"),
    "verification-summary.json",
    options.summary
  );
  return analysis;
}
