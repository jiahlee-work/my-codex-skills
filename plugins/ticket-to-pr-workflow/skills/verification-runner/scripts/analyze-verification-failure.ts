import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseVerificationCliArgs } from "./cli.js";
import { loadVerificationContext } from "./verification-context.js";
import {
  analyzeLatestVerificationFailure,
  generateFailureReport,
  readVerificationSummary
} from "./verification.js";

async function main(): Promise<void> {
  const args = parseVerificationCliArgs(process.argv.slice(2));
  const context = await loadVerificationContext(args);
  const summary = await readVerificationSummary(context.runDir);
  const analysis = await analyzeLatestVerificationFailure({ context, summary });
  await generateFailureReport(context, summary);

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        analysis,
        report: "failure-report.md"
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
