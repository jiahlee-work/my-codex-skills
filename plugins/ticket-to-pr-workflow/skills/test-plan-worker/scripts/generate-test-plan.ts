import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseTestPlanningCliArgs } from "./cli.js";
import { generateTestPlanArtifacts } from "./test-plan.js";

async function main(): Promise<void> {
  const args = parseTestPlanningCliArgs(process.argv.slice(2));
  if (!args.ticketKey && !args.runDir) {
    console.error(
      "Usage: generate-test-plan.ts <ticketKey> [--intent <summary>] [--approved-stack <stack>] [--repo <path>] [--run-dir <path>]"
    );
    process.exitCode = 1;
    return;
  }

  const result = await generateTestPlanArtifacts({
    rootDir: args.rootDir,
    repository: args.repoDir,
    ticketKey: args.ticketKey,
    runDir: args.runDir,
    intent: args.intent,
    approvedStack: args.approvedStack
  });

  console.log(
    JSON.stringify(
      {
        ticketKey: result.ticketKey,
        outputDir: relativeToProject(result.runDir),
        status: result.status,
        files: result.files,
        missingSetup: result.missingSetup
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
