import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import {
  generatePrDescription,
  inspectPrPrerequisites
} from "./pr-reporting.js";

async function main(): Promise<void> {
  const args = parsePrReportingCliArgs(process.argv.slice(2));
  const context = await loadPrReportingContext(args);
  const prerequisites = await inspectPrPrerequisites({
    context,
    repository: args.repoDir,
    approvedPackageChanges: args.approvedPackageChanges,
    approvedStorybookSkip: args.approvedStorybookSkip,
    approvedBrowserSkip: args.approvedBrowserSkip,
    githubMcpAvailable: args.githubMcpAvailable
  });
  if (!prerequisites.safeForPlanning) {
    throw new Error(prerequisites.errors.join("\n"));
  }
  await generatePrDescription(context);
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "pr-description.md"
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
