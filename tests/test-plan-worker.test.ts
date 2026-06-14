import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeTestEnvironment } from "../plugins/ticket-to-pr-workflow/skills/test-plan-worker/scripts/test-environment.js";
import { generateTestPlanArtifacts } from "../plugins/ticket-to-pr-workflow/skills/test-plan-worker/scripts/test-plan.js";

async function writeRun(rootDir: string, ticketKey: string): Promise<string> {
  const runDir = path.join(rootDir, ".agent-runs", `${ticketKey}-2026-06-06T00-00-00-000Z`);
  await mkdir(runDir, { recursive: true });
  const files: Record<string, string> = {
    "ticket-context-report.md": `# Ticket Context Report

## Ticket

${ticketKey} Login error message

## Ticket Content Summary

Show an inline login form error.

## Explicit Requirements

- Show an error after a failed request.
`,
    "requirement-summary.md": `# Requirement Summary

## Description

Update the React login form.

## Acceptance Criteria

- A failed login shows an inline error.
- Editing a field clears the error.
`,
    "task-spec.md": `# Task Spec

## Objective

Implement the login form error state.

## In Scope

- Login form

## Out Of Scope

- Backend API changes.

## Acceptance Criteria

- A failed login shows an inline error.
`,
    "plan-critic-report.md": "# Plan Critic Report\n\n## Risks\n\n- None\n",
    "branch-commit-plan.md": "# Branch And Commit Plan\n"
  };

  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(runDir, fileName), content, "utf8")
    )
  );
  return runDir;
}

describe("test-plan-worker", () => {
  it("detects a Vitest node setup and task-specific frontend gaps", async () => {
    const repository = await mkdtemp(path.join(os.tmpdir(), "test-plan-worker-repo-"));
    await writeFile(
      path.join(repository, "package.json"),
      JSON.stringify({
        scripts: { test: "vitest run" },
        devDependencies: { vitest: "^4.1.8" }
      }),
      "utf8"
    );
    await writeFile(path.join(repository, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await mkdir(path.join(repository, "src"), { recursive: true });
    await writeFile(path.join(repository, "src/example.test.ts"), "export {};\n");

    const analysis = await analyzeTestEnvironment(
      repository,
      "Update the React login form UI."
    );

    expect(analysis.libraries).toEqual(["vitest"]);
    expect(analysis.commands).toEqual(["pnpm test"]);
    expect(analysis.conventions).toContain("*.test.ts");
    expect(analysis.environments).toEqual(["node"]);
    expect(analysis.setupComplete).toBe(false);
    expect(analysis.missingSetup).toContain(
      "Frontend test support is incomplete: Testing Library with jsdom/happy-dom or Playwright is required."
    );
  });

  it("stops for approval, then creates a test plan after stack approval", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "test-plan-worker-root-"));
    const repository = path.join(rootDir, "repo");
    await mkdir(repository);
    await writeFile(
      path.join(repository, "package.json"),
      JSON.stringify({
        scripts: { test: "vitest run" },
        devDependencies: { vitest: "^4.1.8" }
      }),
      "utf8"
    );
    await writeFile(path.join(repository, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const runDir = await writeRun(rootDir, "FE-123");

    const blocked = await generateTestPlanArtifacts({
      rootDir,
      repository,
      ticketKey: "FE-123"
    });

    expect(blocked.status).toBe("approval-required");
    expect(blocked.files).toContain("test-setup-proposal.md");
    await expect(readFile(path.join(runDir, "test-plan.md"), "utf8")).rejects.toThrow();

    const approved = await generateTestPlanArtifacts({
      rootDir,
      repository,
      ticketKey: "FE-123",
      intent: "Keep the existing success path and add visible recoverable errors.",
      approvedStack: "Vitest + Testing Library"
    });

    expect(approved.status).toBe("test-plan-created");
    expect(await readFile(path.join(runDir, "test-plan.md"), "utf8")).toContain(
      "## Test Cases"
    );
    const agentRunReport = await readFile(
      path.join(runDir, "agent-run-report.md"),
      "utf8"
    );
    expect(agentRunReport).toContain("## Test Planning");
    expect(agentRunReport).toContain("Status: test-plan-created");
  });
});
