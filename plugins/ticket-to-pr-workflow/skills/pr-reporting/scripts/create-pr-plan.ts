import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import {
  buildPrPlan,
  inspectPrPrerequisites,
  readValidatedCommitPlan,
  writePrPlan
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
  const commitPlan = await readValidatedCommitPlan(context);
  const plan = await buildPrPlan({
    context,
    repository: args.repoDir,
    commitPlan,
    baseBranch: args.baseBranch,
    title: args.title,
    execute: args.execute
  });
  await writePrPlan(context, plan);
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "pr-plan.md",
        mode: plan.executionMode,
        executionBlocked: !prerequisites.safeForExecution,
        executionBlockers: prerequisites.executionBlockers
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
