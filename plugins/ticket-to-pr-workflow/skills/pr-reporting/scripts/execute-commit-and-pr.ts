import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import { executeCommitAndPr } from "./pr-reporting.js";

async function main(): Promise<void> {
  const args = parsePrReportingCliArgs(process.argv.slice(2));
  const context = await loadPrReportingContext(args);
  const result = await executeCommitAndPr({
    context,
    repository: args.repoDir,
    baseBranch: args.baseBranch,
    title: args.title,
    execute: args.execute,
    approvedPackageChanges: args.approvedPackageChanges,
    approvedStorybookSkip: args.approvedStorybookSkip,
    approvedBrowserSkip: args.approvedBrowserSkip,
    githubMcpAvailable: args.githubMcpAvailable
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        mode: args.execute ? "execute" : "dry-run",
        ...result
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
