import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parsePrReportingCliArgs } from "./cli.js";
import { loadPrReportingContext } from "./pr-context.js";
import {
  buildPrPlan,
  finalizeAgentRunReport,
  readValidatedCommitPlan,
  type ExecutionResult
} from "./pr-reporting.js";

async function main(): Promise<void> {
  const args = parsePrReportingCliArgs(process.argv.slice(2));
  const context = await loadPrReportingContext(args);
  const commitPlan = await readValidatedCommitPlan(context);
  const prPlan = await buildPrPlan({
    context,
    repository: args.repoDir,
    commitPlan,
    baseBranch: args.baseBranch,
    title: args.title,
    execute: false
  });
  const existingPrUrl = context.inputs.agentRunReport?.match(
    /^PR URL:\s*(https:\/\/github\.com\/.+\/pull\/\d+)\s*$/m
  )?.[1];
  const existingFailed =
    context.inputs.agentRunReport?.match(
      /^## PR Status\s*\r?\n+\s*(failed)\s*$/m
    )?.[1] === "failed";
  const execution: ExecutionResult = {
    status: existingPrUrl ? "created" : existingFailed ? "failed" : "dry-run",
    commitHashes: [],
    pushed: Boolean(existingPrUrl),
    ...(existingPrUrl ? { prUrl: existingPrUrl } : {})
  };
  await finalizeAgentRunReport({ context, commitPlan, prPlan, execution });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "agent-run-report.md",
        dryRun: execution.status === "dry-run"
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
