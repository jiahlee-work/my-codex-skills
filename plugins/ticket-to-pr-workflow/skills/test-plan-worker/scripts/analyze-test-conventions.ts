import {
  readTestPlanningInputs,
  resolveTestPlanningRunDir
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

  console.log(
    JSON.stringify(
      {
        outputDir: relativeToProject(runDir),
        testFiles: analysis.testFiles,
        conventions: analysis.conventions,
        directories: analysis.directories,
        configFiles: analysis.configFiles
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
