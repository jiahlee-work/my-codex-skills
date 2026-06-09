import { relativeToProject } from "../../../shared/core/artifact-path.js";
import {
  collectWorkingTreeDiff,
  detectRiskyChanges,
  writeDiffArtifacts,
  writeRiskArtifact
} from "./implementation-artifacts.js";
import { parseImplementationCliArgs } from "./cli.js";
import { loadImplementationContext } from "./implementation-context.js";

async function main(): Promise<void> {
  const args = parseImplementationCliArgs(process.argv.slice(2));
  const context = await loadImplementationContext(args);
  const diff = await collectWorkingTreeDiff({
    repository: args.repoDir,
    ticketKey: context.ticketKey,
    reasons: args.reasons
  });
  const risk = detectRiskyChanges({
    context,
    diff,
    approvedConfigChanges: args.approvedConfigChanges
  });
  await Promise.all([
    writeDiffArtifacts(context.runDir, diff),
    writeRiskArtifact(context.runDir, risk, diff)
  ]);

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        report: "risk-detection-report.md",
        shouldStop: risk.shouldStop,
        findings: risk.findings
      },
      null,
      2
    )
  );
  if (risk.shouldStop) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
