import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  loadPrReportingContext,
  resolvePrReportingRunDir
} from "../plugins/ticket-to-pr-workflow/skills/pr-reporting/scripts/pr-context.js";
import {
  buildCommitPlan,
  buildPrPlan,
  executeCommitAndPr,
  generatePrDescription,
  inspectDeliveryVerificationGates,
  inspectPrPrerequisites,
  parseCommitPlan,
  validateCommitPlan,
  writeCommitPlan,
  writePrPlan
} from "../plugins/ticket-to-pr-workflow/skills/pr-reporting/scripts/pr-reporting.js";

const execFileAsync = promisify(execFile);

async function git(repository: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repository, ...args], {
    encoding: "utf8"
  });
  return result.stdout.trim();
}

async function createRepository(options: {
  packageChange?: boolean;
} = {}): Promise<{ rootDir: string; repository: string }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pr-reporting-root-"));
  const repository = path.join(rootDir, "repo");
  const origin = path.join(rootDir, "origin.git");
  await mkdir(repository);
  await execFileAsync("git", ["init", "--bare", origin]);
  await git(repository, "init", "-b", "main");
  await git(repository, "config", "user.email", "codex@example.invalid");
  await git(repository, "config", "user.name", "Codex Test");
  await mkdir(path.join(repository, "src"));
  await writeFile(
    path.join(repository, "src/message.ts"),
    "export const message = \"\";\n",
    "utf8"
  );
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify({ scripts: { test: "vitest run" } }, null, 2),
    "utf8"
  );
  await git(repository, "add", ".");
  await git(repository, "commit", "-m", "initial");
  await git(repository, "remote", "add", "origin", origin);
  await git(repository, "push", "-u", "origin", "main");
  await git(repository, "switch", "-c", "feature/FE-123-login-error-message");
  await writeFile(
    path.join(repository, "src/message.ts"),
    "export const message = \"Login failed\";\n",
    "utf8"
  );
  await writeFile(
    path.join(repository, "src/message.test.ts"),
    "import { expect, it } from \"vitest\";\nimport { message } from \"./message.js\";\nit(\"shows the error\", () => expect(message).toBe(\"Login failed\"));\n",
    "utf8"
  );
  if (options.packageChange) {
    await writeFile(
      path.join(repository, "package.json"),
      JSON.stringify(
        { scripts: { test: "vitest run", typecheck: "tsc --noEmit" } },
        null,
        2
      ),
      "utf8"
    );
  }
  return { rootDir, repository };
}

async function writePrReportingRun(options: {
  rootDir: string;
  verificationResult?: "passed" | "failed";
  includeVerification?: boolean;
  packageChange?: boolean;
}): Promise<string> {
  const runDir = path.join(
    options.rootDir,
    ".agent-runs",
    "FE-123-2026-06-07T00-00-00-000Z"
  );
  await mkdir(runDir, { recursive: true });
  const changedFiles = [
    {
      path: "src/message.ts",
      changeType: "modified",
      reason: "Show the failed login message."
    },
    {
      path: "src/message.test.ts",
      changeType: "added",
      reason: "Cover the failed login message."
    },
    ...(options.packageChange
      ? [
          {
            path: "package.json",
            changeType: "modified",
            reason: "Update project scripts."
          }
        ]
      : [])
  ];
  const files: Record<string, string> = {
    "branch-commit-plan.md": `# Branch And Commit Plan

## Proposed Branch

\`\`\`text
feature/FE-123-login-error-message
\`\`\`

## Proposed Commit

\`\`\`text
feat: 로그인 실패 메시지 표시
Refs: FE-123
\`\`\`

## Commit Strategy

logical
`,
    "changed-files.json": JSON.stringify({
      ticketKey: "FE-123",
      changedFiles
    }),
    "diff-summary.md": `# Diff Summary

## Totals

- Changed files: ${changedFiles.length}
`,
    "implementation-summary.md": `# Implementation Summary

## What Changed

- Show a recoverable login failure message.
`,
    "code-review-report.md": `# Code Review Report

## Decision

approved

## Task Spec Alignment

- The implementation matches the approved task.

## Risk Findings

- None

## Required Fixes

- None
`,
    "ticket-context-report.md": `# Ticket Context Report

## Ticket

FE-123 Login error message

## Source

- Source: manual
`,
    "requirement-summary.md": `# Requirement Summary

## Description

Show a recoverable login failure message.
`,
    "task-spec.md": `# Task Spec

## Objective

Show a recoverable login failure message.

## Test Plan Draft

- Run focused unit tests.
`,
    "plan-critic-report.md": "# Plan Critic Report\n\n## Risks\n\n- None\n",
    "user-implementation-intent.md": `# User Implementation Intent

## Summary

Keep the success path and add a visible login failure message.
`
  };
  if (options.includeVerification !== false) {
    files["verification-report.md"] = `# Verification Report

## Summary

Lint, typecheck, and tests passed.

## Commands

| Step | Status |
| --- | --- |
| test | passed |

## Result

${options.verificationResult ?? "passed"}
`;
  }
  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(runDir, fileName), content, "utf8")
    )
  );
  return runDir;
}

describe("pr-reporting", () => {
  it("blocks final execution until Storybook and browser scenario gates are resolved", async () => {
    const { rootDir } = await createRepository();
    const runDir = await writePrReportingRun({ rootDir });

    const missing = await inspectDeliveryVerificationGates({ runDir });
    expect(missing.storybookStatus).toBe("not-run");
    expect(missing.browserScenarioStatus).toBe("not-run");
    expect(missing.blockers.join("\n")).toContain("storybook-report.md");
    expect(missing.blockers.join("\n")).toContain("browser-verification-report.md");

    await writeFile(
      path.join(runDir, "storybook-report.md"),
      "# Storybook Report\n\n## Storybook Status\n\npassed\n",
      "utf8"
    );
    await writeFile(
      path.join(runDir, "browser-verification-report.md"),
      "# Browser Verification Report\n\n## Browser Verification Status\n\nskipped\n",
      "utf8"
    );
    const skipped = await inspectDeliveryVerificationGates({ runDir });
    expect(skipped.blockers.join("\n")).toContain("--approve-browser-skip");

    const approved = await inspectDeliveryVerificationGates({
      runDir,
      approvedBrowserSkip: true
    });
    expect(approved.blockers).toEqual([]);
  });

  it("requires every PR Reporting input and reports the missing artifact", async () => {
    const { rootDir } = await createRepository();
    const runDir = await writePrReportingRun({
      rootDir,
      includeVerification: false
    });

    await expect(
      resolvePrReportingRunDir({ rootDir, runDir })
    ).rejects.toThrow("verification-report.md");
  });

  it("builds and validates logical, squash, and step-based commit plans", async () => {
    const { rootDir } = await createRepository();
    const runDir = await writePrReportingRun({ rootDir });
    const context = await loadPrReportingContext({ rootDir, runDir });
    const expectedFiles = context.inputs.changedFilesArtifact.changedFiles.map(
      (file) => file.path
    );

    const logical = buildCommitPlan({ context, strategy: "logical" });
    const squash = buildCommitPlan({ context, strategy: "squash" });
    const stepBased = buildCommitPlan({ context, strategy: "step-based" });

    expect(logical.commits).toHaveLength(2);
    expect(logical.commits[0]?.message).toContain("test:");
    expect(logical.commits[1]?.message).toContain("feat:");
    expect(squash.commits).toHaveLength(1);
    expect(stepBased.commits).toHaveLength(2);
    expect(validateCommitPlan(logical, expectedFiles).valid).toBe(true);
    expect(validateCommitPlan(squash, expectedFiles).valid).toBe(true);
    expect(validateCommitPlan(stepBased, expectedFiles).valid).toBe(true);
  });

  it("generates all dry-run artifacts without creating commits or pushing", async () => {
    const { rootDir, repository } = await createRepository();
    const runDir = await writePrReportingRun({ rootDir });
    await writeFile(
      path.join(runDir, "agent-run-report.md"),
      "# Agent Run Report\n\n## Planning\n\n- Status: planning-created\n",
      "utf8"
    );
    const context = await loadPrReportingContext({ rootDir, runDir });
    const prerequisites = await inspectPrPrerequisites({
      context,
      repository
    });

    expect(prerequisites.safeForPlanning).toBe(true);
    expect(prerequisites.uncommittedChanges).toBe(true);
    expect(prerequisites.originExists).toBe(true);

    const commitPlan = buildCommitPlan({ context, strategy: "logical" });
    const validation = await writeCommitPlan(context, commitPlan);
    expect(validation.valid).toBe(true);
    const parsed = parseCommitPlan(
      await readFile(path.join(runDir, "commit-plan.md"), "utf8")
    );
    expect(parsed.commits).toEqual(commitPlan.commits);

    const description = await generatePrDescription(context);
    expect(description).toContain("## Linked Ticket\nFE-123");
    expect(description).toContain("Result: passed");
    const prPlan = await buildPrPlan({
      context,
      repository,
      commitPlan
    });
    await writePrPlan(context, prPlan);
    const before = await git(repository, "rev-list", "--count", "HEAD");
    const result = await executeCommitAndPr({
      context,
      repository,
      execute: false
    });
    const after = await git(repository, "rev-list", "--count", "HEAD");

    expect(result.status).toBe("dry-run");
    expect(after).toBe(before);
    expect(await git(repository, "status", "--short")).toContain("src/message.ts");
    expect(await readFile(path.join(runDir, "pr-plan.md"), "utf8")).toContain(
      "## Execution Mode\ndry-run"
    );
    const finalReport = await readFile(
      path.join(runDir, "agent-run-report.md"),
      "utf8"
    );
    expect(finalReport).toContain("PR URL: not created");
    expect(finalReport).toContain("## Planning\n\n- Status: planning-created");
    expect(finalReport).toContain("## PR Delivery");
    expect(finalReport).toContain("- Dry Run: yes");
  });

  it("blocks planning when verification failed", async () => {
    const { rootDir, repository } = await createRepository();
    const runDir = await writePrReportingRun({
      rootDir,
      verificationResult: "failed"
    });
    const context = await loadPrReportingContext({ rootDir, runDir });
    const prerequisites = await inspectPrPrerequisites({
      context,
      repository
    });

    expect(prerequisites.safeForPlanning).toBe(false);
    expect(prerequisites.errors.join("\n")).toContain(
      "verification-report.md result must be passed"
    );
  });

  it("allows package changes in a dry-run but blocks execution without approval", async () => {
    const { rootDir, repository } = await createRepository({
      packageChange: true
    });
    const runDir = await writePrReportingRun({
      rootDir,
      packageChange: true
    });
    const context = await loadPrReportingContext({ rootDir, runDir });
    const blocked = await inspectPrPrerequisites({
      context,
      repository
    });
    const approved = await inspectPrPrerequisites({
      context,
      repository,
      approvedPackageChanges: true
    });

    expect(blocked.safeForPlanning).toBe(true);
    expect(blocked.safeForExecution).toBe(false);
    expect(blocked.executionBlockers.join("\n")).toContain(
      "--approved-package-changes"
    );
    expect(approved.packageChangesApproved).toBe(true);
  });

  it("redacts credential-bearing origin URLs and blocks the run", async () => {
    const { rootDir, repository } = await createRepository();
    const runDir = await writePrReportingRun({ rootDir });
    await git(
      repository,
      "remote",
      "set-url",
      "origin",
      "https://token-value@example.com/repository.git"
    );
    const context = await loadPrReportingContext({ rootDir, runDir });
    const prerequisites = await inspectPrPrerequisites({
      context,
      repository
    });

    expect(prerequisites.safeForPlanning).toBe(false);
    expect(prerequisites.originUrl).toBe("[redacted credential-bearing URL]");
    expect(JSON.stringify(prerequisites)).not.toContain("token-value");
  });

  it("blocks when the remote branch would require a force push", async () => {
    const { rootDir, repository } = await createRepository();
    const runDir = await writePrReportingRun({ rootDir });
    await git(repository, "add", "src/message.ts", "src/message.test.ts");
    await git(repository, "commit", "-m", "remote branch commit");
    await git(
      repository,
      "push",
      "-u",
      "origin",
      "feature/FE-123-login-error-message"
    );
    await git(repository, "reset", "--hard", "main");
    await writeFile(
      path.join(repository, "src/message.ts"),
      "export const message = \"Login failed\";\n",
      "utf8"
    );
    await writeFile(
      path.join(repository, "src/message.test.ts"),
      "export const expected = \"Login failed\";\n",
      "utf8"
    );
    const context = await loadPrReportingContext({ rootDir, runDir });
    const prerequisites = await inspectPrPrerequisites({
      context,
      repository
    });

    expect(prerequisites.forcePushRequired).toBe(true);
    expect(prerequisites.safeForPlanning).toBe(false);
    expect(prerequisites.errors.join("\n")).toContain("force push");
  });
});
