import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";

export type StorybookCliArgs = {
  rootDir: string;
  repoDir: string;
  runDir?: string;
  writeStories: boolean;
  skipInstall: boolean;
  executeSetup: boolean;
  setupCommand?: string;
  timeoutMs: number;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseTimeout(value?: string): number {
  if (value === undefined) {
    return 10 * 60 * 1000;
  }
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms "${value}". Use a positive integer.`);
  }
  return timeoutMs;
}

export function parseStorybookCliArgs(args: string[]): StorybookCliArgs {
  const rootDir = path.resolve(readOption(args, "--root") ?? projectRoot);
  const executeSetup = args.includes("--execute-setup");
  const skipInstall = args.includes("--skip-install");
  if (executeSetup && skipInstall) {
    throw new Error("Use either --execute-setup or --skip-install, not both.");
  }

  return {
    rootDir,
    repoDir: path.resolve(readOption(args, "--repo") ?? rootDir),
    runDir: readOption(args, "--agent-run") ?? readOption(args, "--run-dir"),
    writeStories: args.includes("--write-stories"),
    skipInstall,
    executeSetup,
    setupCommand: readOption(args, "--setup-command"),
    timeoutMs: parseTimeout(readOption(args, "--timeout-ms"))
  };
}
