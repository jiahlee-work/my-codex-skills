import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import {
  detectStorybookEnvironment,
  renderStorybookEnvironmentReport,
  runStorybookChecks
} from "./storybook.js";

async function main(): Promise<void> {
  const args = parseStorybookCliArgs(process.argv.slice(2));
  const context = await loadStorybookContext(args);
  const environment = await detectStorybookEnvironment(args.repoDir);
  await writeTextFile(
    context.runDir,
    "storybook-environment-report.md",
    renderStorybookEnvironmentReport(environment)
  );
  const summary = await runStorybookChecks({
    context,
    repository: args.repoDir,
    environment:
      environment.status === "configured"
        ? environment
        : { ...environment, commands: [] },
    timeoutMs: args.timeoutMs
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        environmentStatus: environment.status,
        ...summary,
        log: "logs/storybook.log"
      },
      null,
      2
    )
  );
  if (summary.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
