import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import { runStorybookWorkflow } from "./storybook.js";

async function main(): Promise<void> {
  const args = parseStorybookCliArgs(process.argv.slice(2));
  const context = await loadStorybookContext(args);
  const result = await runStorybookWorkflow({
    context,
    repository: args.repoDir,
    writeStories: args.writeStories,
    skipInstall: args.skipInstall,
    executeSetup: args.executeSetup,
    setupCommand: args.setupCommand,
    timeoutMs: args.timeoutMs
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        status: result.status,
        environmentStatus: result.environment.status,
        changedUiComponents: result.plan?.components.length ?? 0,
        storiesWritten: result.writeResult?.stories.length ?? 0,
        checks: result.checks?.status ?? "not-run",
        report: "storybook-report.md"
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
