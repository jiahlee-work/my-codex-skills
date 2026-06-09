import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";

export type ImplementationCliArgs = {
  ticketKey?: string;
  rootDir: string;
  repoDir: string;
  runDir?: string;
  intent?: string;
  allowDirty: boolean;
  approvedConfigChanges: boolean;
  intentConflict?: string;
  notes?: string;
  reasons: Record<string, string>;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRepeatedOptions(args: string[], name: string): string[] {
  return args.flatMap((value, index) =>
    value === name && args[index + 1] ? [args[index + 1] as string] : []
  );
}

function positionalTicketKey(args: string[]): string | undefined {
  const optionsWithValues = new Set([
    "--root",
    "--repo",
    "--run-dir",
    "--intent",
    "--intent-conflict",
    "--notes",
    "--reason"
  ]);

  return args.find((arg, index) => {
    if (arg.startsWith("--")) {
      return false;
    }
    return !optionsWithValues.has(args[index - 1] ?? "");
  });
}

function parseReasons(values: string[]): Record<string, string> {
  return Object.fromEntries(
    values.map((value) => {
      const separator = value.indexOf("=");
      if (separator < 1) {
        throw new Error(`Invalid --reason value "${value}". Use <path>=<reason>.`);
      }
      return [value.slice(0, separator), value.slice(separator + 1)];
    })
  );
}

export function parseImplementationCliArgs(args: string[]): ImplementationCliArgs {
  const rootDir = path.resolve(readOption(args, "--root") ?? projectRoot);

  return {
    ticketKey: positionalTicketKey(args),
    rootDir,
    repoDir: path.resolve(readOption(args, "--repo") ?? rootDir),
    runDir: readOption(args, "--run-dir"),
    intent: readOption(args, "--intent"),
    allowDirty: args.includes("--allow-dirty"),
    approvedConfigChanges: args.includes("--approved-config-changes"),
    intentConflict: readOption(args, "--intent-conflict"),
    notes: readOption(args, "--notes"),
    reasons: parseReasons(readRepeatedOptions(args, "--reason"))
  };
}
