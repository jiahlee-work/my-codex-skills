import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import {
  detectStorybookEnvironment,
  executeStorybookSetup,
  prepareStorybookPlan,
  recordApprovedSetupChanges,
  renderStorybookEnvironmentReport,
  renderStorybookSetupProposal,
  updateStorybookReports,
  writeApprovedStories
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
      await recordApprovedSetupChanges(context, setup);
      if (setup.status === "failed") {
        await updateStorybookReports({ context, environment, status: "failed" });
        throw new Error(setup.error ?? "Storybook setup failed.");
      }
      environment = await detectStorybookEnvironment(args.repoDir);
      await writeTextFile(
        context.runDir,
        "storybook-environment-report.md",
        renderStorybookEnvironmentReport(environment)
      );
    }
  }

  if (environment.status !== "configured") {
    const status = args.skipInstall ? "skipped" : "approval-required";
    await updateStorybookReports({ context, environment, status });
    console.log(
      JSON.stringify(
        {
          ticketKey: context.ticketKey,
          outputDir: relativeToProject(context.runDir),
          status,
          report: null,
          proposal: "storybook-setup-proposal.md"
        },
        null,
        2
      )
    );
    return;
  }

  let prepared = await prepareStorybookPlan({
    context,
    repository: args.repoDir,
    environment
  });
  let written = 0;
  let skipped: string[] = [];
  if (args.writeStories) {
    const writeResult = await writeApprovedStories({
      context,
      repository: args.repoDir,
      plan: prepared.plan
    });
    written = writeResult.stories.length;
    skipped = writeResult.skipped;
    environment = await detectStorybookEnvironment(args.repoDir);
    await writeTextFile(
      context.runDir,
      "storybook-environment-report.md",
      renderStorybookEnvironmentReport(environment)
    );
    prepared = await prepareStorybookPlan({
      context,
      repository: args.repoDir,
      environment
    });
  }
  const status = prepared.plan.actions.some(
    (action) => action.missingStates.length > 0
  )
    ? "approval-required"
    : "skipped";
  await updateStorybookReports({ context, environment, status });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        status,
        report: "storybook-plan.md",
        changedUiComponents: prepared.plan.components.length,
        storyActions: prepared.plan.actions.length,
        written,
        skipped
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
