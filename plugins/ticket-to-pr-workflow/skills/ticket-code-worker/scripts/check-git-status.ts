import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { inspectGitSafety } from "../../../shared/core/git-worktree.js";
import { parseImplementationCliArgs } from "./cli.js";
import { loadImplementationContext } from "./implementation-context.js";

async function main(): Promise<void> {
  const args = parseImplementationCliArgs(process.argv.slice(2));
  const context = await loadImplementationContext(args);
  const result = await inspectGitSafety({
    repository: args.repoDir,
    plannedBranch: context.branchName,
    allowDirty: args.allowDirty
  });

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        ...result
      },
      null,
      2
    )
  );
  if (!result.safeToCreateBranch) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
