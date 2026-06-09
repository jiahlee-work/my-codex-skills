import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";
import type { CommitStrategy } from "./pr-context.js";

export type PrReportingCliArgs = {
  rootDir: string;
  repoDir: string;
  runDir?: string;
  strategy?: CommitStrategy;
  baseBranch?: string;
  title?: string;
  execute: boolean;
  dryRun: boolean;
  approvedPackageChanges: boolean;
  approvedStorybookSkip: boolean;
  approvedBrowserSkip: boolean;
  githubMcpAvailable: boolean;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseStrategy(value?: string): CommitStrategy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "logical" || value === "squash" || value === "step-based") {
    return value;
  }
  throw new Error(
    `Invalid --strategy "${value}". Use logical, squash, or step-based.`
  );
}

export function parsePrReportingCliArgs(args: string[]): PrReportingCliArgs {
  const rootDir = path.resolve(readOption(args, "--root") ?? projectRoot);
  const execute = args.includes("--execute");
  if (execute && args.includes("--dry-run")) {
    throw new Error("Use either --dry-run or --execute, not both.");
  }

  return {
    rootDir,
    repoDir: path.resolve(readOption(args, "--repo") ?? rootDir),
    runDir: readOption(args, "--agent-run") ?? readOption(args, "--run-dir"),
    strategy: parseStrategy(readOption(args, "--strategy")),
    baseBranch: readOption(args, "--base"),
    title: readOption(args, "--title"),
    execute,
    dryRun: !execute,
    approvedPackageChanges: args.includes("--approved-package-changes"),
    approvedStorybookSkip: args.includes("--approve-storybook-skip"),
    approvedBrowserSkip: args.includes("--approve-browser-skip"),
    githubMcpAvailable:
      args.includes("--github-mcp-available") ||
      process.env.CODEX_GITHUB_MCP_AVAILABLE === "1"
  };
}
