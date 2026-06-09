import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseVerificationCliArgs } from "./cli.js";
import { loadVerificationContext } from "./verification-context.js";
import {
  generateFailureReport,
  readVerificationSummary
} from "./verification.js";

async function main(): Promise<void> {
  const args = parseVerificationCliArgs(process.argv.slice(2));
  const context = await loadVerificationContext(args);
  const summary = await readVerificationSummary(context.runDir);
  const report = await generateFailureReport(context, summary);
  if (!report) {
    throw new Error("No failed verification result is available for failure-report.md.");
  }

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
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
