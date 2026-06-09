import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import {
  detectStorybookEnvironment,
  renderStorybookEnvironmentReport,
  updateStorybookReports
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
  await updateStorybookReports({
    context,
    environment,
    status: environment.status === "configured" ? "skipped" : "approval-required"
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        status: environment.status,
        configured: environment.status === "configured",
        dependencies: environment.dependencies,
        configFiles: environment.configFiles,
        storyFiles: environment.storyFiles,
        commands: environment.commands
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
