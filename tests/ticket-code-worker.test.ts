import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  collectWorkingTreeDiff,
  detectRiskyChanges,
  updateImplementationAgentRunReport,
  writeCodeReviewReport,
  writeDiffArtifacts,
  writeImplementationSummary,
  writeRiskArtifact
} from "../plugins/ticket-to-pr-workflow/skills/ticket-code-worker/scripts/implementation-artifacts.js";
import {
  createWorkingBranch,
  inspectGitSafety
} from "../plugins/ticket-to-pr-workflow/shared/core/git-worktree.js";
import {
  loadImplementationContext,
  resolveImplementationRunDir
} from "../plugins/ticket-to-pr-workflow/skills/ticket-code-worker/scripts/implementation-context.js";

const execFileAsync = promisify(execFile);

async function git(repository: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repository, ...args], {
    encoding: "utf8"
  });
  return result.stdout.trim();
}

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-repo-"));
  await git(repository, "init", "-b", "main");
  await git(repository, "config", "user.email", "codex@example.invalid");
  await git(repository, "config", "user.name", "Codex Test");
  await mkdir(path.join(repository, "src"), { recursive: true });
  await writeFile(path.join(repository, ".gitignore"), ".agent-runs/\n", "utf8");
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify({ scripts: { test: "vitest run" } }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(repository, "src/login.ts"),
    "export function loginMessage(): string {\n  return \"\";\n}\n",
    "utf8"
  );
  await git(repository, "add", ".");
  await git(repository, "commit", "-m", "initial");
  return repository;
}

async function writeImplementationRun(
  rootDir: string,
  options: {
    includeTestPlan?: boolean;
    includeIntent?: boolean;
    approvedStack?: boolean;
  } = {}
): Promise<string> {
  const runDir = path.join(
    rootDir,
    ".agent-runs",
    "FE-123-2026-06-07T00-00-00-000Z"
  );
  await mkdir(runDir, { recursive: true });
  const files: Record<string, string> = {
    "ticket-context-report.md": `# Ticket Context Report

## Ticket

FE-123 Login error message

## Ticket Content Summary

Show a login error.
`,
    "requirement-summary.md": `# Requirement Summary

## Description

Update the login behavior.
`,
    "task-spec.md": `# Task Spec

## Objective

Update src/login.ts to expose a recoverable login error.

## In Scope

- Login message behavior

## Acceptance Criteria

- Failed login has a visible message.

## Test Plan Draft

- Run \`pnpm test\`.
`,
    "plan-critic-report.md": "# Plan Critic Report\n\n## Risks\n\n- Authentication UI\n",
    "branch-commit-plan.md": `# Branch And Commit Plan

## Proposed Branch

\`\`\`text
fix/FE-123-login-error-message
\`\`\`
`,
    "test-environment-report.md": `# Test Environment Report

## Detected Test Commands

- \`pnpm test\`

## Detected Test File Conventions

- \`*.test.ts\`
`,
    "agent-run-report.md": `# Agent Run Report

## Test Planning

- Approved test stack: ${
      options.approvedStack === false ? "not approved" : "Vitest"
    }
`
  };
  if (options.includeTestPlan !== false) {
    files["test-plan.md"] = `# Test Plan

## Test Objectives

- Verify the login error message.

## Test Cases

### Case 1

- Scenario: Failed login
- Expected: Visible message
`;
  }
  if (options.includeIntent !== false) {
    files["user-implementation-intent.md"] = `# User Implementation Intent

## Summary

Add a recoverable login error message and focused tests.
`;
  }
  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(runDir, fileName), content, "utf8")
    )
  );
  return runDir;
}

describe("ticket-code-worker", () => {
  it("requires test-plan.md before implementation", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-root-"));
    const runDir = await writeImplementationRun(rootDir, { includeTestPlan: false });

    await expect(resolveImplementationRunDir({ rootDir, runDir })).rejects.toThrow(
      "Run test-plan-worker first"
    );
  });

  it("requires a current conversation summary when the intent artifact is absent", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-root-"));
    const runDir = await writeImplementationRun(rootDir, { includeIntent: false });

    await expect(loadImplementationContext({ rootDir, runDir })).rejects.toThrow(
      "pass it with --intent"
    );
    const context = await loadImplementationContext({
      rootDir,
      runDir,
      intent: "Keep the success path and add a recoverable login error."
    });
    expect(context.intentSummary).toContain("recoverable login error");
    expect(await readFile(path.join(runDir, "user-implementation-intent.md"), "utf8"))
      .toContain("Current conversation");
  });

  it("creates the validated branch and refuses an existing branch collision", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-root-"));
    const repository = await createRepository();
    const runDir = await writeImplementationRun(rootDir);
    const context = await loadImplementationContext({ rootDir, runDir });
    const dirtyPath = path.join(repository, "unrelated.txt");
    await writeFile(dirtyPath, "pre-existing change\n", "utf8");
    const dirty = await inspectGitSafety({
      repository,
      plannedBranch: context.branchName
    });
    expect(dirty.safeToCreateBranch).toBe(false);
    expect(dirty.errors.join("\n")).toContain("uncommitted changes");
    const approvedDirty = await inspectGitSafety({
      repository,
      plannedBranch: context.branchName,
      allowDirty: true
    });
    expect(approvedDirty.safeToCreateBranch).toBe(true);
    await unlink(dirtyPath);
    const safety = await inspectGitSafety({
      repository,
      plannedBranch: context.branchName
    });

    expect(safety.currentBranch).toBe("main");
    expect(safety.safeToCreateBranch).toBe(true);
    expect(safety.safeToImplement).toBe(false);

    const created = await createWorkingBranch({
      repository,
      plannedBranch: context.branchName
    });
    expect(created.created).toBe(true);
    expect(await git(repository, "branch", "--show-current")).toBe(context.branchName);

    await git(repository, "switch", "main");
    const collision = await inspectGitSafety({
      repository,
      plannedBranch: context.branchName
    });
    expect(collision.safeToCreateBranch).toBe(false);
    expect(collision.errors.join("\n")).toContain("already exists");
    expect(collision.errors.join("\n")).toContain("-2");
  });

  it("collects implementation and test diffs and writes Implementation reports", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-root-"));
    const repository = await createRepository();
    const runDir = await writeImplementationRun(rootDir);
    const context = await loadImplementationContext({ rootDir, runDir });
    await createWorkingBranch({ repository, plannedBranch: context.branchName });
    await writeFile(
      path.join(repository, "src/login.ts"),
      "export function loginMessage(): string {\n  return \"Login failed\";\n}\n",
      "utf8"
    );
    await writeFile(
      path.join(repository, "src/login.test.ts"),
      "import { expect, it } from \"vitest\";\nimport { loginMessage } from \"./login.js\";\nit(\"shows an error\", () => expect(loginMessage()).toBe(\"Login failed\"));\n",
      "utf8"
    );

    const diff = await collectWorkingTreeDiff({
      repository,
      ticketKey: context.ticketKey
    });
    const risk = detectRiskyChanges({ context, diff });
    await Promise.all([
      writeDiffArtifacts(runDir, diff),
      writeRiskArtifact(runDir, risk, diff),
      writeImplementationSummary({ context, diff, risk }),
      writeCodeReviewReport({ context, diff, risk })
    ]);
    await updateImplementationAgentRunReport({ context, diff, risk });

    expect(diff.changedFiles.map((file) => file.path).sort()).toEqual([
      "src/login.test.ts",
      "src/login.ts"
    ]);
    expect(diff.diffLineCount).toBeGreaterThan(0);
    expect(risk.shouldStop).toBe(false);
    expect(risk.findings.some((item) => item.category === "sensitive-area")).toBe(true);
    expect(await readFile(path.join(runDir, "implementation-summary.md"), "utf8"))
      .toContain("## Suggested Verification");
    expect(await readFile(path.join(runDir, "code-review-report.md"), "utf8"))
      .toContain("approved_with_comments");
    expect(JSON.parse(await readFile(path.join(runDir, "changed-files.json"), "utf8")))
      .toMatchObject({ ticketKey: "FE-123" });
    expect(await readFile(path.join(runDir, "agent-run-report.md"), "utf8"))
      .toContain("## Ticket Code Work");
  });

  it("blocks unapproved package changes and protected-branch code changes", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-code-worker-root-"));
    const repository = await createRepository();
    const runDir = await writeImplementationRun(rootDir, { approvedStack: false });
    const context = await loadImplementationContext({ rootDir, runDir });
    await writeFile(
      path.join(repository, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run", build: "tsc" } }, null, 2),
      "utf8"
    );

    const diff = await collectWorkingTreeDiff({
      repository,
      ticketKey: context.ticketKey
    });
    const risk = detectRiskyChanges({ context, diff });

    expect(diff.branchName).toBe("main");
    expect(risk.shouldStop).toBe(true);
    expect(risk.findings.map((item) => item.id)).toEqual(
      expect.arrayContaining(["protected-branch", "package-json"])
    );
  });
});
