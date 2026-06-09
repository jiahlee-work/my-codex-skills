import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { parseVerificationCliArgs } from "./cli.js";
import {
  decideVerificationMode,
  loadVerificationContext
} from "./verification-context.js";
import { resolveVerificationCommands } from "./verification.js";

async function main(): Promise<void> {
  const args = parseVerificationCliArgs(process.argv.slice(2));
  const context = await loadVerificationContext(args);
  const decision = decideVerificationMode(context, args.mode);
  const resolution = await resolveVerificationCommands({
    repository: args.repoDir,
    mode: decision.selectedMode
  });

  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        decision,
        ...resolution
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
