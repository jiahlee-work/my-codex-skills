import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import {
  detectStorybookEnvironment,
  executeStorybookSetup,
  recordApprovedSetupChanges,
  renderStorybookEnvironmentReport,
  renderStorybookSetupProposal,
  updateStorybookReports
} from "./storybook.js";

async function main(): Promise<void> {
  const args = parseStorybookCliArgs(process.argv.slice(2));
  const context = await loadStorybookContext(args);
  let environment = await detectStorybookEnvironment(args.repoDir);
  await writeTextFile(
    context.runDir,
    "storybook-environment-report.md",
    renderStorybookEnvironmentReport(environment)
  );
  let setupStatus: string | undefined;
  let changedFiles: string[] = [];

  if (environment.status !== "configured") {
    await writeTextFile(
      context.runDir,
      "storybook-setup-proposal.md",
      await renderStorybookSetupProposal(environment)
    );
    if (args.executeSetup) {
      const setup = await executeStorybookSetup({
        context,
        repository: args.repoDir,
        environment,
        setupCommand: args.setupCommand,
        timeoutMs: args.timeoutMs
      });
      setupStatus = setup.status;
      changedFiles = setup.changedFiles;
      await recordApprovedSetupChanges(context, setup);
      environment = await detectStorybookEnvironment(args.repoDir);
      await writeTextFile(
        context.runDir,
        "storybook-environment-report.md",
        renderStorybookEnvironmentReport(environment)
      );
    }
  }

  const status =
    setupStatus === "failed"
      ? "failed"
      : environment.status === "configured"
        ? "skipped"
        : args.skipInstall
          ? "skipped"
          : "approval-required";
  await updateStorybookReports({ context, environment, status });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        proposal:
          environment.status === "configured" && !setupStatus
            ? null
            : "storybook-setup-proposal.md",
        environmentStatus: environment.status,
        approvalRequired:
          environment.status !== "configured" && !args.skipInstall,
        setupStatus,
        changedFiles
      },
      null,
      2
    )
  );
  if (setupStatus === "failed") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
