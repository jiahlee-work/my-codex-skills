import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";
import type { VerificationMode } from "./verification.js";

export const defaultVerificationTimeoutMs = 5 * 60 * 1000;

export type VerificationCliArgs = {
  rootDir: string;
  repoDir: string;
  runDir?: string;
  mode?: VerificationMode;
  modeExplicit: boolean;
  continueOnFailure: boolean;
  timeoutMs: number;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseMode(value?: string): VerificationMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "light" || value === "full") {
    return value;
  }
  throw new Error(`Invalid --mode "${value}". Use light or full.`);
}

function parseTimeout(value?: string): number {
  if (value === undefined) {
    return defaultVerificationTimeoutMs;
  }
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms "${value}". Use a positive integer.`);
  }
  return timeoutMs;
}

export function parseVerificationCliArgs(args: string[]): VerificationCliArgs {
  const rootDir = path.resolve(readOption(args, "--root") ?? projectRoot);
  const agentRun = readOption(args, "--agent-run") ?? readOption(args, "--run-dir");
  const modeValue = readOption(args, "--mode");

  return {
    rootDir,
    repoDir: path.resolve(readOption(args, "--repo") ?? rootDir),
    runDir: agentRun,
    mode: parseMode(modeValue),
    modeExplicit: modeValue !== undefined,
    continueOnFailure: args.includes("--continue-on-failure"),
    timeoutMs: parseTimeout(readOption(args, "--timeout-ms"))
  };
}
