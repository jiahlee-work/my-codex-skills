import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { generateBrowserVerificationReport } from "./browser-scenario.js";
import { parseBrowserCliArgs } from "./cli.js";
import { loadBrowserContext } from "./browser-context.js";

async function main(): Promise<void> {
  const args = parseBrowserCliArgs(process.argv.slice(2));
  const context = await loadBrowserContext(args);
  const result = await generateBrowserVerificationReport({
    context,
    status: args.status,
    mcpNotes: args.mcpNotes,
    targetUrl: args.targetUrl,
    approveStaging: args.approveStaging
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        status: result.status,
        executionPath: result.executionPath,
        report: "browser-verification-report.md"
      },
      null,
      2
    )
  );
  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
