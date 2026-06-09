import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import {
  loadPrReportingContext,
  strategyFromBranchPlan
} from "./pr-context.js";
import {
  buildCommitPlan,
  inspectPrPrerequisites,
  writeCommitPlan
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
  const plan = buildCommitPlan({
    context,
    strategy: args.strategy ?? strategyFromBranchPlan(context.inputs.branchCommitPlan),
    dryRun: args.dryRun
  });
  const validation = await writeCommitPlan(context, plan);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "commit-plan.md",
        strategy: plan.strategy,
        commits: plan.commits.length,
        validation
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
