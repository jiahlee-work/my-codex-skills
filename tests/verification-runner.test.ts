import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decideVerificationMode,
  loadVerificationContext,
  resolveVerificationRunDir,
  type VerificationContext
} from "../plugins/ticket-to-pr-workflow/skills/verification-runner/scripts/verification-context.js";
import {
  analyzeVerificationFailure,
  generateVerificationReports,
  resolveVerificationCommands,
  runVerification
} from "../plugins/ticket-to-pr-workflow/skills/verification-runner/scripts/verification.js";

async function writeVerificationRun(
  rootDir: string,
  options: {
    changedFiles?: string[];
    diffLineCount?: number;
    riskReport?: string;
  } = {}
): Promise<string> {
  const runDir = path.join(
    rootDir,
    ".agent-runs",
    "FE-123-2026-06-07T00-00-00-000Z"
  );
  await mkdir(runDir, { recursive: true });
  const changedFiles = options.changedFiles ?? ["src/message.ts", "src/message.test.ts"];
  const files: Record<string, string> = {
    "task-spec.md": `# Task Spec

## Objective

Update a small message helper.
`,
    "test-environment-report.md": `# Test Environment Report

## Detected Test Commands

- \`pnpm test\`
`,
    "test-plan.md": `# Test Plan

## Test Objectives

- Verify the message helper.
`,
    "changed-files.json": JSON.stringify({
      ticketKey: "FE-123",
      changedFiles: changedFiles.map((filePath) => ({
        path: filePath,
        changeType: "modified",
        reason: "Ticket-scoped change."
      }))
    }),
    "diff-summary.md": `# Diff Summary

## Totals

- Changed files: ${changedFiles.length}
- Diff line count: ${options.diffLineCount ?? 20}
`,
    "implementation-summary.md": `# Implementation Summary

## What Changed

- Updated the message helper.
`,
    "code-review-report.md": `# Code Review Report

## Decision

approved
`,
    "agent-run-report.md": "# Agent Run Report\n"
  };
  if (options.riskReport) {
    files["risk-detection-report.md"] = options.riskReport;
  }
  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(runDir, fileName), content, "utf8")
    )
  );
  return runDir;
}

async function writeRepository(
  rootDir: string,
  scripts: Record<string, string>,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const repository = path.join(rootDir, "repo");
  await mkdir(repository, { recursive: true });
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify(
      {
        packageManager: "pnpm@11.5.2",
        scripts,
        ...extra
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(repository, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return repository;
}

describe("verification-runner", () => {
  it("classifies a small TypeScript failure without treating log metadata as a timeout", () => {
    const analysis = analyzeVerificationFailure({
      step: "typecheck",
      command: "pnpm typecheck",
      log: `Command: pnpm typecheck
src/message.ts:1:1 error TS2322: Type mismatch
Timed out: no`
    });

    expect(analysis.failureLocation).toBe("src/message.ts:1:1");
    expect(analysis.classification).toBe("type_error");
    expect(analysis.retryAllowed).toBe(true);
    expect(analysis.retryReason).toContain("localized TypeScript errors");
  });

  it("requires all Local Verification inputs and reports missing artifact names", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir);
    await writeFile(path.join(runDir, "test-plan.md"), "", "utf8");
    const missingRun = path.join(rootDir, ".agent-runs", "FE-124-missing");
    await mkdir(missingRun);
    await writeFile(path.join(missingRun, "task-spec.md"), "# Task Spec\n", "utf8");

    await expect(
      resolveVerificationRunDir({ rootDir, runDir: missingRun })
    ).rejects.toThrow("test-environment-report.md");
    expect(await resolveVerificationRunDir({ rootDir })).toBe(runDir);
  });

  it("resolves package scripts, TypeScript fallback, and optional E2E without running it", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const repository = await writeRepository(rootDir, {
      lint: "eslint .",
      test: "vitest run",
      build: "tsc -p tsconfig.build.json",
      "test:e2e": "playwright test"
    });
    await writeFile(path.join(repository, "tsconfig.json"), "{}\n", "utf8");

    const resolution = await resolveVerificationCommands({
      repository,
      mode: "full"
    });

    expect(resolution.packageManager).toBe("pnpm");
    expect(resolution.commands.map((command) => command.command)).toEqual([
      "pnpm lint",
      "tsc --noEmit",
      "pnpm test",
      "pnpm build"
    ]);
    expect(resolution.optionalCommands).toEqual([
      expect.objectContaining({
        name: "test:e2e",
        command: "pnpm test:e2e"
      })
    ]);
  });

  it("recommends full mode from scope risk and warns on an explicit light override", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir, {
      changedFiles: ["src/LoginForm.tsx"],
      diffLineCount: 201
    });
    await writeFile(
      path.join(runDir, "task-spec.md"),
      "# Task Spec\n\n## Objective\n\nUpdate the login form UI flow and API request.\n",
      "utf8"
    );
    const context = await loadVerificationContext({ rootDir, runDir });

    const automatic = decideVerificationMode(context);
    const override = decideVerificationMode(context, "light");

    expect(automatic.selectedMode).toBe("full");
    expect(automatic.riskSignals).toContain("UI flow change detected.");
    expect(automatic.riskSignals).toContain("Diff line count 201 exceeds 200.");
    expect(override.selectedMode).toBe("light");
    expect(override.warnings[0]).toContain("full verification is recommended");
  });

  it("runs light verification, writes logs, and treats the excluded build as expected", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir);
    const repository = await writeRepository(rootDir, {
      lint: "node -e \"console.log('lint passed')\"",
      typecheck: "node -e \"console.log('typecheck passed')\"",
      test: "node -e \"console.log('test passed')\""
    });
    const context = await loadVerificationContext({ rootDir, runDir });
    const decision = decideVerificationMode(context, "light");

    const summary = await runVerification({
      context,
      repository,
      decision,
      continueOnFailure: false,
      timeoutMs: 30_000
    });
    await generateVerificationReports(context, summary);

    expect(summary.result).toBe("passed");
    expect(summary.commands.map((command) => command.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "skipped"
    ]);
    expect(await readFile(path.join(runDir, "logs/lint.log"), "utf8")).toContain(
      "lint passed"
    );
    expect(await readFile(path.join(runDir, "verification-report.md"), "utf8"))
      .toContain("## Result\npassed");
    expect(await readFile(path.join(runDir, "agent-run-report.md"), "utf8"))
      .toContain("## Local Verification");
  });

  it("limits retries to three attempts and blocks later commands by default", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir);
    const repository = await writeRepository(rootDir, {
      typecheck:
        "node -e \"console.error('src/message.ts:1:1 error TS2322: Type mismatch'); process.exit(1)\"",
      test: "node -e \"console.log('must not run')\""
    });
    const context: VerificationContext = await loadVerificationContext({ rootDir, runDir });
    const decision = decideVerificationMode(context, "light");

    const summary = await runVerification({
      context,
      repository,
      decision,
      continueOnFailure: false,
      timeoutMs: 30_000
    });
    await generateVerificationReports(context, summary);
    const typecheck = summary.commands.find((command) => command.step === "typecheck");
    const test = summary.commands.find((command) => command.step === "test");

    expect(typecheck?.attempts).toHaveLength(3);
    expect(typecheck?.attempts[0]?.failureAnalysis?.classification).toBe("type_error");
    expect(test?.status).toBe("blocked");
    expect(summary.result).toBe("failed");
    expect(await readFile(path.join(runDir, "failure-report.md"), "utf8"))
      .toContain("## Retry Attempts\n2");
  });

  it("continues with available commands when continue-on-failure is enabled", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir);
    const repository = await writeRepository(rootDir, {
      lint: "node -e \"console.error('lint failed'); process.exit(1)\"",
      typecheck: "node -e \"console.log('typecheck passed')\"",
      test: "node -e \"console.log('test passed')\""
    });
    const context = await loadVerificationContext({ rootDir, runDir });

    const summary = await runVerification({
      context,
      repository,
      decision: decideVerificationMode(context, "light"),
      continueOnFailure: true,
      timeoutMs: 30_000
    });

    expect(summary.commands.map((command) => command.status)).toEqual([
      "failed",
      "passed",
      "passed",
      "skipped"
    ]);
    expect(summary.result).toBe("failed");
  });

  it("enforces the per-command timeout and records exit code 124", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "verification-root-"));
    const runDir = await writeVerificationRun(rootDir);
    const repository = await writeRepository(rootDir, {
      typecheck: "node -e \"setTimeout(() => {}, 10000)\""
    });
    const context = await loadVerificationContext({ rootDir, runDir });

    const summary = await runVerification({
      context,
      repository,
      decision: decideVerificationMode(context, "light"),
      continueOnFailure: false,
      timeoutMs: 100
    });
    const typecheck = summary.commands.find((command) => command.step === "typecheck");

    expect(typecheck?.attempts).toHaveLength(3);
    expect(typecheck?.exitCode).toBe(124);
    expect(typecheck?.attempts.every((attempt) => attempt.timedOut)).toBe(true);
  });
});
