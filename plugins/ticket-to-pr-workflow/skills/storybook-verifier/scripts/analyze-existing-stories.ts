import { relativeToProject } from "../../../shared/core/artifact-path.js";
import { writeTextFile } from "../../../shared/core/fs.js";
import { parseStorybookCliArgs } from "./cli.js";
import { loadStorybookContext } from "./storybook-context.js";
import {
  analyzeExistingStories,
  detectStorybookEnvironment,
  identifyChangedUiComponents,
  renderStorybookEnvironmentReport
} from "./storybook.js";

async function main(): Promise<void> {
  const args = parseStorybookCliArgs(process.argv.slice(2));
  const context = await loadStorybookContext(args);
  const environment = await detectStorybookEnvironment(args.repoDir);
  const analysis = await analyzeExistingStories(args.repoDir, environment);
  const components = await identifyChangedUiComponents(
    context,
    args.repoDir,
    analysis
  );
  await writeTextFile(
    context.runDir,
    "storybook-environment-report.md",
    renderStorybookEnvironmentReport(environment)
  );
  console.log(
    JSON.stringify(
      {
        ticketKey: context.ticketKey,
        outputDir: relativeToProject(context.runDir),
        environmentStatus: environment.status,
        conventions: analysis.conventions,
        stories: analysis.stories,
        changedUiComponents: components.map((component) => ({
          path: component.path,
          states: component.relevantStates,
          existingStories: component.existingStoryPaths
        }))
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
