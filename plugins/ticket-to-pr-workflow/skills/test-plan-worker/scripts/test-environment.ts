import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../../../shared/core/fs.js";
import { markdownList } from "../../../shared/core/markdown.js";

const knownLibraries = [
  "vitest",
  "jest",
  "@testing-library/react",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
  "@playwright/test",
  "playwright",
  "msw",
  "jsdom",
  "happy-dom"
] as const;

const ignoredDirectories = new Set([
  ".agent-runs",
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules"
]);

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type TestTaskNeeds = {
  dom: boolean;
  apiMocking: boolean;
  e2e: boolean;
};

export type TestConventionAnalysis = {
  testFiles: string[];
  conventions: string[];
  configFiles: string[];
  directories: string[];
};

export type TestEnvironmentAnalysis = {
  repository: string;
  packageManager: "pnpm" | "npm" | "yarn" | "unknown";
  lockFiles: string[];
  libraries: string[];
  commands: string[];
  configFiles: string[];
  testFiles: string[];
  conventions: string[];
  directories: string[];
  environments: string[];
  taskNeeds: TestTaskNeeds;
  missingSetup: string[];
  recommendedNextAction: string;
  setupComplete: boolean;
};

async function walkFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
          return;
        }

        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(absolutePath);
        } else if (entry.isFile()) {
          files.push(path.relative(rootDir, absolutePath));
        }
      })
    );
  }

  await visit(rootDir);
  return files.sort();
}

function detectTaskNeeds(taskContext: string): TestTaskNeeds {
  return {
    dom: /\b(frontend|react|component|form|page|screen|ui|tsx|dom)\b/i.test(taskContext),
    apiMocking: /\b(api|request|fetch|network|endpoint|backend|login|checkout|payment)\b/i.test(
      taskContext
    ),
    e2e: /\b(e2e|end[- ]to[- ]end|browser flow|checkout|payment)\b/i.test(taskContext)
  };
}

function testConventionForFile(fileName: string): string | undefined {
  const match = fileName.match(/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/);
  return match ? `*.${match[1]}.${match[2]}` : undefined;
}

export function analyzeTestConventions(files: string[]): TestConventionAnalysis {
  const testFiles = files.filter(
    (fileName) =>
      /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(fileName) ||
      fileName.split(path.sep).includes("__tests__") ||
      fileName.startsWith(`tests${path.sep}`)
  );
  const configFiles = files.filter((fileName) =>
    /(^|\/)(vitest|jest|playwright)\.config\.[^/]+$/.test(fileName)
  );
  const conventions = new Set(
    testFiles.map(testConventionForFile).filter((value): value is string => Boolean(value))
  );
  const directories = new Set<string>();

  if (testFiles.some((fileName) => fileName.split(path.sep).includes("__tests__"))) {
    directories.add("__tests__/");
  }
  if (testFiles.some((fileName) => fileName.startsWith(`tests${path.sep}`))) {
    directories.add("tests/");
  }
  if (testFiles.some((fileName) => fileName.startsWith(`src${path.sep}`))) {
    directories.add("src/ co-located tests");
  }

  return {
    testFiles,
    configFiles,
    conventions: [...conventions].sort(),
    directories: [...directories].sort()
  };
}

function packageManagerFor(lockFiles: string[]): TestEnvironmentAnalysis["packageManager"] {
  if (lockFiles.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (lockFiles.includes("package-lock.json")) {
    return "npm";
  }
  if (lockFiles.includes("yarn.lock")) {
    return "yarn";
  }
  return "unknown";
}

function commandPrefix(packageManager: TestEnvironmentAnalysis["packageManager"]): string {
  return packageManager === "unknown" ? "npm run" : packageManager;
}

function detectCommands(
  packageJson: PackageJson,
  packageManager: TestEnvironmentAnalysis["packageManager"],
  libraries: string[],
  configFiles: string[]
): string[] {
  const commands: string[] = [];
  const prefix = commandPrefix(packageManager);

  for (const scriptName of ["test", "test:unit", "test:watch", "test:e2e"]) {
    if (packageJson.scripts?.[scriptName]) {
      commands.push(
        packageManager === "npm"
          ? scriptName === "test"
            ? "npm test"
            : `npm run ${scriptName}`
          : `${prefix} ${scriptName}`
      );
    }
  }

  if (
    libraries.some((library) => library === "@playwright/test" || library === "playwright") ||
    configFiles.some((fileName) => path.basename(fileName).startsWith("playwright.config."))
  ) {
    commands.push(
      packageManager === "npm" ? "npx playwright test" : `${prefix} playwright test`
    );
  }

  return [...new Set(commands)];
}

export async function analyzeTestEnvironment(
  repository: string,
  taskContext = ""
): Promise<TestEnvironmentAnalysis> {
  const packagePath = path.join(repository, "package.json");
  const packageJson: PackageJson = (await pathExists(packagePath))
    ? JSON.parse(await readFile(packagePath, "utf8")) as PackageJson
    : {};
  const files = await walkFiles(repository);
  const lockFiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"].filter((fileName) =>
    files.includes(fileName)
  );
  const packageManager = packageManagerFor(lockFiles);
  const dependencies = {
    ...packageJson.peerDependencies,
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const libraries = knownLibraries.filter((library) => Boolean(dependencies[library]));
  const conventions = analyzeTestConventions(files);
  const commands = detectCommands(
    packageJson,
    packageManager,
    libraries,
    conventions.configFiles
  );
  const taskNeeds = detectTaskNeeds(taskContext);
  const configContents = (
    await Promise.all(
      conventions.configFiles.map((fileName) =>
        readFile(path.join(repository, fileName), "utf8").catch(() => "")
      )
    )
  ).join("\n");
  const environments: string[] = [];

  if (libraries.includes("jsdom") || /\bjsdom\b/i.test(configContents)) {
    environments.push("jsdom");
  }
  if (libraries.includes("happy-dom") || /\bhappy-dom\b/i.test(configContents)) {
    environments.push("happy-dom");
  }
  if (
    libraries.includes("@playwright/test") ||
    libraries.includes("playwright") ||
    conventions.configFiles.some((fileName) => path.basename(fileName).startsWith("playwright."))
  ) {
    environments.push("browser (Playwright)");
  }
  if (
    environments.length === 0 &&
    (libraries.includes("vitest") || libraries.includes("jest"))
  ) {
    environments.push("node");
  }

  const hasRunner = libraries.some((library) =>
    ["vitest", "jest", "@playwright/test", "playwright"].includes(library)
  );
  const hasCommand = commands.length > 0;
  const hasDomUnitStack =
    libraries.includes("@testing-library/react") &&
    libraries.includes("@testing-library/user-event") &&
    libraries.includes("@testing-library/jest-dom") &&
    (environments.includes("jsdom") || environments.includes("happy-dom"));
  const hasBrowserStack = environments.includes("browser (Playwright)");
  const missingSetup: string[] = [];

  if (!hasRunner) {
    missingSetup.push("No supported unit or browser test runner is configured.");
  }
  if (!hasCommand) {
    missingSetup.push("No supported test command is defined in package.json.");
  }
  if (taskNeeds.dom && !hasDomUnitStack && !hasBrowserStack) {
    missingSetup.push(
      "Frontend test support is incomplete: Testing Library with jsdom/happy-dom or Playwright is required."
    );
  }

  const setupComplete = missingSetup.length === 0;

  return {
    repository,
    packageManager,
    lockFiles,
    libraries,
    commands,
    configFiles: conventions.configFiles,
    testFiles: conventions.testFiles,
    conventions: conventions.conventions,
    directories: conventions.directories,
    environments,
    taskNeeds,
    missingSetup,
    recommendedNextAction: setupComplete
      ? "Existing test setup is available. Create a test plan based on the task spec."
      : "Create test-setup-proposal.md and request user approval before any test setup change.",
    setupComplete
  };
}

export function renderTestEnvironmentReport(analysis: TestEnvironmentAnalysis): string {
  const conventions = [
    ...analysis.conventions.map((item) => `\`${item}\``),
    ...analysis.directories.map((item) => `\`${item}\``)
  ];

  return `# Test Environment Report

## Detected Test Libraries

${markdownList(analysis.libraries)}

## Detected Test Commands

${markdownList(analysis.commands.map((command) => `\`${command}\``))}

## Detected Test Config Files

${markdownList(analysis.configFiles.map((fileName) => `\`${fileName}\``))}

## Detected Test File Conventions

${markdownList(conventions)}

## Detected Test Environment

${markdownList(analysis.environments)}

## Missing Test Setup

${markdownList(analysis.missingSetup)}

## Recommended Next Action

${analysis.recommendedNextAction}
`;
}
