import path from "node:path";
import {
  readTestPlanningInputs,
  resolveTestPlanningRunDir,
  updateTestPlanningAgentRunReport
} from "./test-planning-context.js";
import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { parseTestPlanningCliArgs } from "./cli.js";
import {
  analyzeTestEnvironment,
  renderTestEnvironmentReport
} from "./test-environment.js";
import { buildTestTaskContext } from "./test-plan.js";

async function main(): Promise<void> {
  const args = parseTestPlanningCliArgs(process.argv.slice(2));
  const runDir = await resolveTestPlanningRunDir(args);
  const inputs = await readTestPlanningInputs(runDir);
  const analysis = await analyzeTestEnvironment(
    args.repoDir,
    buildTestTaskContext(inputs)
  );

  await writeTextFile(
    runDir,
    "test-environment-report.md",
    renderTestEnvironmentReport(analysis)
  );
  await updateTestPlanningAgentRunReport(runDir, {
    status: analysis.setupComplete ? "environment-detected" : "approval-required",
    repository: args.repoDir,
    generatedFiles: ["test-environment-report.md"],
    missingSetup: analysis.missingSetup
  });

  console.log(
    JSON.stringify(
      {
        outputDir: relativeToProject(runDir),
        report: path.join(relativeToProject(runDir), "test-environment-report.md"),
        setupComplete: analysis.setupComplete,
        missingSetup: analysis.missingSetup
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
