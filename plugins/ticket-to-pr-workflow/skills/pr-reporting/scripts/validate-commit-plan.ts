import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import {
  readValidatedCommitPlan,
  validateCommitPlan
} from "./pr-reporting.js";

async function main(): Promise<void> {
  const args = parsePrReportingCliArgs(process.argv.slice(2));
  const context = await loadPrReportingContext(args);
  const plan = await readValidatedCommitPlan(context);
  const validation = validateCommitPlan(
    plan,
    context.inputs.changedFilesArtifact.changedFiles.map((file) => file.path)
  );
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
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
