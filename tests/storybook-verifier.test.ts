import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadStorybookContext,
  resolveStorybookRunDir
} from "../plugins/ticket-to-pr-workflow/skills/storybook-verifier/scripts/storybook-context.js";
import {
  detectStorybookEnvironment,
  executeStorybookSetup,
  renderStorybookSetupProposal,
  runStorybookWorkflow
} from "../plugins/ticket-to-pr-workflow/skills/storybook-verifier/scripts/storybook.js";

async function writeStorybookRun(
  rootDir: string,
  options: {
    includeVerification?: boolean;
    changedFiles?: string[];
  } = {}
): Promise<string> {
  const runDir = path.join(
    rootDir,
    ".agent-runs",
    "FE-123-2026-06-07T00-00-00-000Z"
  );
  await mkdir(runDir, { recursive: true });
  const changedFiles = options.changedFiles ?? ["src/LoginForm.tsx"];
  const files: Record<string, string> = {
    "changed-files.json": JSON.stringify({
      ticketKey: "FE-123",
      changedFiles: changedFiles.map((filePath) => ({
        path: filePath,
        changeType: "modified",
        reason: "Add visible login states."
      }))
    }),
    "diff-summary.md": `# Diff Summary

## Totals

- Changed files: ${changedFiles.length}
`,
    "implementation-summary.md": `# Implementation Summary

## What Changed

- Added loading, disabled, and recoverable login error UI states.
`,
    "code-review-report.md": `# Code Review Report

## Decision

approved
`,
    "task-spec.md": `# Task Spec

## Objective

Show the login form loading and error states.
`,
    "user-implementation-intent.md": `# User Implementation Intent

## Summary

Keep default behavior and expose loading, error, and disabled states.
`,
    "pr-plan.md": `# PR Plan

## Ticket

FE-123

## Execution Mode

dry-run
`,
    "agent-run-report.md": "# Agent Run Report\n"
  };
  if (options.includeVerification !== false) {
    files["verification-report.md"] = `# Verification Report

## Result

passed
`;
  }
  await Promise.all(
    Object.entries(files).map(([fileName, content]) =>
      writeFile(path.join(runDir, fileName), content, "utf8")
    )
  );
  return runDir;
}

async function writeConfiguredRepository(
  rootDir: string,
  options: {
    existingStory?: string;
    buildScript?: string;
  } = {}
): Promise<string> {
  const repository = path.join(rootDir, "repo");
  await mkdir(path.join(repository, "src"), { recursive: true });
  await mkdir(path.join(repository, ".storybook"), { recursive: true });
  await writeFile(
    path.join(repository, "package.json"),
    JSON.stringify(
      {
        scripts: {
          "storybook:build":
            options.buildScript ??
            "node -e \"console.log('storybook build passed')\""
        },
        dependencies: {
          react: "^19.0.0"
        },
        devDependencies: {
          "@storybook/react-vite": "^9.0.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(repository, "package-lock.json"), "{}\n", "utf8");
  await writeFile(
    path.join(repository, ".storybook/main.ts"),
    "export default { stories: ['../src/**/*.stories.@(ts|tsx)'] };\n",
    "utf8"
  );
  await writeFile(
    path.join(repository, "src/LoginForm.tsx"),
    `import React from "react";

export type LoginFormProps = {
  loading?: boolean;
  error?: string;
  disabled?: boolean;
};

export function LoginForm({ loading, error, disabled }: LoginFormProps) {
  return <button disabled={disabled}>{loading ? "Loading" : error ?? "Login"}</button>;
}
`,
    "utf8"
  );
  if (options.existingStory) {
    await writeFile(
      path.join(repository, "src/LoginForm.stories.tsx"),
      options.existingStory,
      "utf8"
    );
  }
  return repository;
}

describe("storybook-verifier", () => {
  it("requires all Storybook Verification inputs and names missing artifacts", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const runDir = await writeStorybookRun(rootDir, {
      includeVerification: false
    });

    await expect(resolveStorybookRunDir({ rootDir, runDir })).rejects.toThrow(
      "verification-report.md"
    );
  });

  it("reports a missing Storybook setup without failing detection or mutating setup", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const repository = path.join(rootDir, "repo");
    await mkdir(path.join(repository, "src"), { recursive: true });
    const packageJson = JSON.stringify({ scripts: { test: "vitest run" } }, null, 2);
    await writeFile(path.join(repository, "package.json"), packageJson, "utf8");
    await writeFile(
      path.join(repository, "src/LoginForm.tsx"),
      "export function LoginForm() { return null; }\n",
      "utf8"
    );
    const runDir = await writeStorybookRun(rootDir);
    const context = await loadStorybookContext({ rootDir, runDir });

    const environment = await detectStorybookEnvironment(repository);
    expect(environment.status).toBe("not-configured");
    expect(await renderStorybookSetupProposal(environment)).toContain(
      "## Approval Required"
    );

    const result = await runStorybookWorkflow({
      context,
      repository,
      writeStories: false,
      skipInstall: false,
      executeSetup: false,
      timeoutMs: 30_000
    });

    expect(result.status).toBe("approval-required");
    expect(await readFile(path.join(repository, "package.json"), "utf8")).toBe(
      packageJson
    );
    expect(
      await readFile(path.join(runDir, "storybook-setup-proposal.md"), "utf8")
    ).toContain("Option 1. Install Storybook");
    expect(await readFile(path.join(runDir, "storybook-report.md"), "utf8")).toContain(
      "## Storybook Status\napproval-required"
    );
  });

  it("executes an explicitly approved custom setup and records changed setup files", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const repository = path.join(rootDir, "repo");
    await mkdir(repository, { recursive: true });
    await writeFile(
      path.join(repository, "package.json"),
      JSON.stringify({ scripts: {} }, null, 2),
      "utf8"
    );
    await writeFile(path.join(repository, "package-lock.json"), "{}\n", "utf8");
    const runDir = await writeStorybookRun(rootDir);
    const context = await loadStorybookContext({ rootDir, runDir });
    const environment = await detectStorybookEnvironment(repository);
    const setupSource = `
const fs = require("node:fs");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.scripts["storybook:build"] = "true";
packageJson.devDependencies = { "@storybook/react-vite": "1.0.0" };
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
fs.mkdirSync(".storybook", { recursive: true });
fs.writeFileSync(".storybook/main.ts", "export default {};\\n");
`;
    const encodedSetup = Buffer.from(setupSource).toString("base64");

    const setup = await executeStorybookSetup({
      context,
      repository,
      environment,
      setupCommand: `node -e "eval(Buffer.from('${encodedSetup}', 'base64').toString())"`,
      timeoutMs: 30_000
    });

    expect(setup.status).toBe("passed");
    expect(setup.changedFiles).toContain("package.json");
    expect(setup.changedFiles).toContain(".storybook/main.ts");
    expect(
      (await detectStorybookEnvironment(repository)).status
    ).toBe("configured");
    expect(
      await readFile(path.join(runDir, "logs/storybook-setup.log"), "utf8")
    ).toContain("Approved: yes");
  });

  it("writes an approved simple React story, runs the build, and updates reports", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const repository = await writeConfiguredRepository(rootDir);
    const runDir = await writeStorybookRun(rootDir);
    const context = await loadStorybookContext({ rootDir, runDir });

    const result = await runStorybookWorkflow({
      context,
      repository,
      writeStories: true,
      skipInstall: false,
      executeSetup: false,
      timeoutMs: 30_000
    });

    expect(result.status).toBe("passed");
    expect(result.writeResult?.stories).toEqual([
      expect.objectContaining({
        path: "src/LoginForm.stories.tsx",
        states: ["default", "loading", "error", "disabled"]
      })
    ]);
    const story = await readFile(
      path.join(repository, "src/LoginForm.stories.tsx"),
      "utf8"
    );
    expect(story).toContain("export const Default");
    expect(story).toContain("export const Loading");
    expect(story).toContain("export const Error");
    expect(story).toContain("export const Disabled");
    expect(await readFile(path.join(runDir, "logs/storybook.log"), "utf8")).toContain(
      "storybook build passed"
    );
    expect(await readFile(path.join(runDir, "changed-files.json"), "utf8")).toContain(
      "src/LoginForm.stories.tsx"
    );
    expect(await readFile(path.join(runDir, "pr-plan.md"), "utf8")).toContain(
      "## Storybook Status\n\npassed"
    );
    expect(await readFile(path.join(runDir, "agent-run-report.md"), "utf8")).toContain(
      "## Storybook Verification"
    );
  });

  it("keeps existing story updates approval-gated even when checks pass", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const repository = await writeConfiguredRepository(rootDir, {
      existingStory: `import type { Meta, StoryObj } from "@storybook/react";
import { LoginForm } from "./LoginForm";
const meta = { component: LoginForm } satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
`
    });
    const runDir = await writeStorybookRun(rootDir);
    const context = await loadStorybookContext({ rootDir, runDir });

    const result = await runStorybookWorkflow({
      context,
      repository,
      writeStories: false,
      skipInstall: false,
      executeSetup: false,
      timeoutMs: 30_000
    });

    expect(result.checks?.status).toBe("passed");
    expect(result.status).toBe("approval-required");
    expect(result.plan?.actions[0]?.missingStates).toEqual([
      "loading",
      "error",
      "disabled"
    ]);
    expect(await readFile(path.join(runDir, "storybook-plan.md"), "utf8")).toContain(
      "Existing stories require context-aware manual updates"
    );
  });

  it("marks a configured check failure as failed", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "storybook-root-"));
    const repository = await writeConfiguredRepository(rootDir, {
      existingStory: `import type { Meta, StoryObj } from "@storybook/react";
import { LoginForm } from "./LoginForm";
const meta = { component: LoginForm } satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Error: Story = { args: { error: "Failed" } };
export const Disabled: Story = { args: { disabled: true } };
`,
      buildScript: "node -e \"console.error('storybook build failed'); process.exit(1)\""
    });
    const runDir = await writeStorybookRun(rootDir);
    const context = await loadStorybookContext({ rootDir, runDir });

    const result = await runStorybookWorkflow({
      context,
      repository,
      writeStories: false,
      skipInstall: false,
      executeSetup: false,
      timeoutMs: 30_000
    });

    expect(result.status).toBe("failed");
    expect(await readFile(path.join(runDir, "storybook-report.md"), "utf8")).toContain(
      "PR execution must stop"
    );
  });
});
