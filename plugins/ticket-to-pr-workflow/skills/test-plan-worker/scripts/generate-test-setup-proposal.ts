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
import {
  buildTestTaskContext,
  renderTestSetupProposal
} from "./test-plan.js";

async function main(): Promise<void> {
  const args = parseTestPlanningCliArgs(process.argv.slice(2));
  const runDir = await resolveTestPlanningRunDir(args);
  const inputs = await readTestPlanningInputs(runDir);
  const analysis = await analyzeTestEnvironment(
    args.repoDir,
    buildTestTaskContext(inputs)
  );
  const files = ["test-environment-report.md"];

  await writeTextFile(
    runDir,
    "test-environment-report.md",
    renderTestEnvironmentReport(analysis)
  );

  if (!analysis.setupComplete) {
    await writeTextFile(
      runDir,
      "test-setup-proposal.md",
      renderTestSetupProposal(analysis, args.approvedStack)
    );
    files.push("test-setup-proposal.md");
  }

  await updateTestPlanningAgentRunReport(runDir, {
    status:
      analysis.setupComplete || args.approvedStack
        ? "environment-detected"
        : "approval-required",
    repository: args.repoDir,
    generatedFiles: files,
    missingSetup: analysis.missingSetup,
    approvedStack: args.approvedStack
  });

  console.log(
    JSON.stringify(
      {
        outputDir: relativeToProject(runDir),
        proposal: analysis.setupComplete
          ? null
          : path.join(relativeToProject(runDir), "test-setup-proposal.md"),
        approvalRequired: !analysis.setupComplete && !args.approvedStack
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
