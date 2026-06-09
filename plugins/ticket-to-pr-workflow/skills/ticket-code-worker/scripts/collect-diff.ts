import { relativeToProject } from "../../../shared/core/artifact-path.js";
import {
  collectWorkingTreeDiff,
  writeDiffArtifacts
} from "./implementation-artifacts.js";
import { parseImplementationCliArgs } from "./cli.js";
import { loadImplementationContext } from "./implementation-context.js";

async function main(): Promise<void> {
  const args = parseImplementationCliArgs(process.argv.slice(2));
  const context = await loadImplementationContext(args);
  const diff = await collectWorkingTreeDiff({
    repository: args.repoDir,
    ticketKey: context.ticketKey,
    reasons: args.reasons
  });
  await writeDiffArtifacts(context.runDir, diff);

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        files: ["diff-summary.md", "changed-files.json"],
        changedFileCount: diff.changedFiles.length,
        diffLineCount: diff.diffLineCount
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
