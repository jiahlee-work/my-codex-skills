import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import { inspectPrPrerequisites } from "./pr-reporting.js";

async function main(): Promise<void> {
  const args = parsePrReportingCliArgs(process.argv.slice(2));
  const context = await loadPrReportingContext(args);
  const result = await inspectPrPrerequisites({
    context,
    repository: args.repoDir,
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
        ...result
      },
      null,
      2
    )
  );
  if (!result.safeForPlanning) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
