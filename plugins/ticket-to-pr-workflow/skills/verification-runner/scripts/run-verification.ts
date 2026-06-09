import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseVerificationCliArgs } from "./cli.js";
import {
  decideVerificationMode,
  loadVerificationContext
} from "./verification-context.js";
import {
  generateVerificationReports,
  runVerification
} from "./verification.js";

async function main(): Promise<void> {
  const args = parseVerificationCliArgs(process.argv.slice(2));
  const context = await loadVerificationContext(args);
  const decision = decideVerificationMode(context, args.mode);
  const summary = await runVerification({
    context,
    repository: args.repoDir,
    decision,
    continueOnFailure: args.continueOnFailure,
    timeoutMs: args.timeoutMs
  });
  await generateVerificationReports(context, summary);

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        mode: summary.verificationMode,
        recommendedMode: summary.recommendedMode,
        result: summary.result,
        files: [
          "verification-report.md",
          ...(summary.result === "failed" ? ["failure-report.md"] : []),
          "logs/verification-summary.json",
          ...summary.commands.flatMap((command) => (command.log ? [command.log] : []))
        ]
      },
      null,
      2
    )
  );
  if (summary.result === "failed" || summary.result === "blocked") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
