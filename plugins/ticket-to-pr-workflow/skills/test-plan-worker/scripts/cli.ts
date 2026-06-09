import path from "node:path";
import { projectRoot } from "../../../shared/core/artifact-path.js";

export type TestPlanningCliArgs = {
  ticketKey?: string;
  rootDir: string;
  repoDir: string;
  runDir?: string;
  intent?: string;
  approvedStack?: string;
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseTestPlanningCliArgs(args: string[]): TestPlanningCliArgs {
  const ticketKey = args.find((arg, index) => {
    const previous = args[index - 1];
    return (
      !arg.startsWith("--") &&
      previous !== "--root" &&
      previous !== "--repo" &&
      previous !== "--run-dir" &&
      previous !== "--intent" &&
      previous !== "--approved-stack"
    );
  });
  const rootDir = path.resolve(readOption(args, "--root") ?? projectRoot);

  return {
    ticketKey,
    rootDir,
    repoDir: path.resolve(readOption(args, "--repo") ?? rootDir),
    runDir: readOption(args, "--run-dir"),
    intent: readOption(args, "--intent"),
    approvedStack: readOption(args, "--approved-stack")
  };
}
