import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";
import type { BrowserVerificationStatus } from "./browser-scenario.js";

export type BrowserCliArgs = {
  rootDir: string;
  runDir?: string;
  status?: BrowserVerificationStatus;
  mcpNotes?: string;
  targetUrl?: string;
  approveStaging: boolean;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseStatus(value?: string): BrowserVerificationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    value === "passed" ||
    value === "failed" ||
    value === "skipped" ||
    value === "approval-required"
  ) {
    return value;
  }
  throw new Error(
    `Invalid --status "${value}". Use passed, failed, skipped, or approval-required.`
  );
}

export function parseBrowserCliArgs(args: string[]): BrowserCliArgs {
  return {
    rootDir: path.resolve(readOption(args, "--root") ?? projectRoot),
    runDir: readOption(args, "--agent-run") ?? readOption(args, "--run-dir"),
    status: parseStatus(readOption(args, "--status")),
    mcpNotes: readOption(args, "--mcp-notes"),
    targetUrl: readOption(args, "--target-url"),
    approveStaging: args.includes("--approve-staging")
  };
}
