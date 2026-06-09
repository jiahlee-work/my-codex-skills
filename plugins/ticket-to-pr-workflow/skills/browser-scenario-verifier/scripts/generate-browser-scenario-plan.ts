import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeBrowserScenarioPlan } from "./browser-scenario.js";
import { parseBrowserCliArgs } from "./cli.js";
import { loadBrowserContext } from "./browser-context.js";

async function main(): Promise<void> {
  const args = parseBrowserCliArgs(process.argv.slice(2));
  const context = await loadBrowserContext(args);
  const plan = await writeBrowserScenarioPlan({
    context,
    targetUrl: args.targetUrl
  });
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "browser-scenario-plan.md",
        browserVerificationNeeded: plan.needed,
        reason: plan.reason,
        executionReadiness: plan.executionReadiness
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
