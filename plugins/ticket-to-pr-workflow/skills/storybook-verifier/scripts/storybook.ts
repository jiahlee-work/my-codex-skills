import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { updateAgentRunReportSection } from "../../../shared/core/agent-run-report.js";
import { pathExists, writeJsonFile, writeTextFile } from "../../../shared/core/fs.js";
import { markdownList } from "../../../shared/core/markdown.js";
import type {
  StorybookChangedFile,
  StorybookContext
} from "./storybook-context.js";

const execFileAsync = promisify(execFile);
const resourcesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../resources"
);
const ignoredDirectories = new Set([
  ".agent-runs",
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "storybook-static"
]);

export type StorybookStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "approval-required";

export type StorybookEnvironmentStatus =
  | "configured"
  | "partial"
  | "not-configured";

export type PackageManager = "pnpm" | "npm" | "yarn" | "unknown";

export type StorybookCommandKind = "dev" | "build" | "test" | "chromatic";

export type StorybookCommand = {
  kind: StorybookCommandKind;
  scriptName: string;
  command: string;
};

export type StorybookEnvironment = {
  repository: string;
  status: StorybookEnvironmentStatus;
  packageManager: PackageManager;
  dependencies: string[];
  scripts: Record<string, string>;
  configFiles: string[];
  storyFiles: string[];
  frameworks: string[];
  commands: StorybookCommand[];
  missingSetup: string[];
};

export type ExistingStory = {
  path: string;
  title?: string;
  exports: string[];
  states: string[];
  imports: string[];
  decoratorsOrProviders: string[];
};

export type StoryConventionAnalysis = {
  stories: ExistingStory[];
  conventions: string[];
  decoratorsOrProviders: string[];
};

export type ComponentExport = {
  name: string;
  kind: "default" | "named";
};

export type ChangedUiComponent = {
  path: string;
  source: string;
  componentName: string;
  componentExport?: ComponentExport;
  requiredProps: string[];
  relevantStates: string[];
  existingStoryPaths: string[];
};

export type StoryPlanAction = {
  componentPath: string;
  componentName: string;
  storyPath: string;
  changeType: "add" | "update";
  requiredStates: string[];
  existingStates: string[];
  missingStates: string[];
  requiredMocksOrProviders: string[];
  automaticWriteSupported: boolean;
  automaticWriteReason: string;
  componentExport?: ComponentExport;
};

export type StorybookPlan = {
  ticketKey: string;
  components: ChangedUiComponent[];
  actions: StoryPlanAction[];
  suggestedCommands: string[];
  nonGoals: string[];
};

export type StoryChange = {
  path: string;
  changeType: "added" | "modified";
  states: string[];
  reason: string;
};

export type StoryWriteResult = {
  stories: StoryChange[];
  skipped: string[];
};

export type StorybookCheckAttempt = {
  kind: Exclude<StorybookCommandKind, "dev">;
  command: string;
  status: "passed" | "failed";
  exitCode: number;
  durationMs: number;
};

export type StorybookCheckSummary = {
  status: "passed" | "failed" | "skipped";
  attempts: StorybookCheckAttempt[];
  skippedReason?: string;
};

export type StorybookSetupResult = {
  approved: boolean;
  command: string;
  status: "passed" | "failed";
  changedFiles: string[];
  error?: string;
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type RunStorybookOptions = {
  context: StorybookContext;
  repository: string;
  writeStories: boolean;
  skipInstall: boolean;
  executeSetup: boolean;
  setupCommand?: string;
  timeoutMs: number;
};

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

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
          files.push(normalizePath(path.relative(rootDir, absolutePath)));
        }
      })
    );
  }

  await visit(rootDir);
  return files.sort();
}

function packageManagerFor(files: string[]): PackageManager {
  if (files.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (files.includes("package-lock.json")) {
    return "npm";
  }
  if (files.includes("yarn.lock")) {
    return "yarn";
  }
  return "unknown";
}

function packageScriptCommand(
  packageManager: PackageManager,
  scriptName: string
): string {
  if (packageManager === "npm") {
    return `npm run ${scriptName}`;
  }
  if (packageManager === "yarn") {
    return `yarn ${scriptName}`;
  }
  return `${packageManager === "unknown" ? "npm run" : "pnpm"} ${scriptName}`;
}

function commandKind(
  scriptName: string,
  scriptValue: string
): StorybookCommandKind | undefined {
  const combined = `${scriptName} ${scriptValue}`.toLowerCase();
  if (/\bchromatic\b/.test(combined)) {
    return "chromatic";
  }
  if (/\btest-storybook\b/.test(combined)) {
    return "test";
  }
  if (
    /\bbuild-storybook\b/.test(combined) ||
    /\bstorybook\s+build\b/.test(combined) ||
    /^(storybook:build|build-storybook)$/.test(scriptName)
  ) {
    return "build";
  }
  if (
    /^(storybook|storybook:dev)$/.test(scriptName) ||
    /\bstorybook\s+dev\b/.test(combined)
  ) {
    return "dev";
  }
  return undefined;
}

function detectFrameworks(dependencies: string[]): string[] {
  const frameworks: string[] = [];
  const checks: Array<[RegExp, string]> = [
    [/@storybook\/nextjs/, "Next.js"],
    [/@storybook\/react/, "React"],
    [/@storybook\/vue3?/, "Vue"],
    [/@storybook\/svelte/, "Svelte"],
    [/@storybook\/angular/, "Angular"],
    [/@storybook\/html/, "HTML"]
  ];
  for (const [pattern, label] of checks) {
    if (dependencies.some((dependency) => pattern.test(dependency))) {
      frameworks.push(label);
    }
  }
  return frameworks;
}

function isConfiguredStoryPath(filePath: string): boolean {
  return (
    /^(src|stories)\/.*\.stories\.[^/]+$/.test(filePath) ||
    /^(src|stories)\/.*\.mdx$/.test(filePath)
  );
}

export async function detectStorybookEnvironment(
  repository: string
): Promise<StorybookEnvironment> {
  const files = await walkFiles(repository);
  const packagePath = path.join(repository, "package.json");
  let packageJson: PackageJson = {};
  if (await pathExists(packagePath)) {
    try {
      packageJson = JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;
    } catch {
      throw new Error(`Invalid JSON in ${packagePath}`);
    }
  }
  const dependencyMap = {
    ...packageJson.peerDependencies,
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const dependencies = Object.keys(dependencyMap)
    .filter(
      (dependency) =>
        dependency === "storybook" || dependency.startsWith("@storybook/")
    )
    .sort();
  const scripts = Object.fromEntries(
    Object.entries(packageJson.scripts ?? {}).filter(([name, value]) =>
      /\b(storybook|build-storybook|test-storybook|chromatic)\b/i.test(
        `${name} ${value}`
      )
    )
  );
  const packageManager = packageManagerFor(files);
  const commands = Object.entries(scripts)
    .map(([scriptName, scriptValue]) => {
      const kind = commandKind(scriptName, scriptValue);
      return kind
        ? {
            kind,
            scriptName,
            command: packageScriptCommand(packageManager, scriptName)
          }
        : undefined;
    })
    .filter((command): command is StorybookCommand => Boolean(command))
    .sort((left, right) => {
      const order: StorybookCommandKind[] = ["dev", "build", "test", "chromatic"];
      return order.indexOf(left.kind) - order.indexOf(right.kind);
    });
  const configFiles = files.filter((filePath) =>
    /^\.storybook\/(main|preview)\.[^/]+$/.test(filePath)
  );
  const storyFiles = files.filter(isConfiguredStoryPath);
  const hasMainConfig = configFiles.some((filePath) =>
    /^\.storybook\/main\./.test(filePath)
  );
  const hasRunnableSignal = commands.length > 0;
  const hasAnySignal =
    dependencies.length > 0 ||
    configFiles.length > 0 ||
    storyFiles.length > 0 ||
    Object.keys(scripts).length > 0;
  const status: StorybookEnvironmentStatus =
    dependencies.length > 0 && (hasMainConfig || hasRunnableSignal)
      ? "configured"
      : hasAnySignal
        ? "partial"
        : "not-configured";
  const missingSetup: string[] = [];
  if (dependencies.length === 0) {
    missingSetup.push("No Storybook dependency was detected.");
  }
  if (!hasMainConfig) {
    missingSetup.push("No .storybook/main.* configuration was detected.");
  }
  if (commands.length === 0) {
    missingSetup.push("No Storybook package script was detected.");
  }

  return {
    repository,
    status,
    packageManager,
    dependencies,
    scripts,
    configFiles,
    storyFiles,
    frameworks: detectFrameworks(dependencies),
    commands,
    missingSetup: status === "configured" ? [] : missingSetup
  };
}

export function renderStorybookEnvironmentReport(
  environment: StorybookEnvironment
): string {
  const scripts = Object.entries(environment.scripts).map(
    ([name, value]) => `\`${name}\`: \`${value}\``
  );
  return `# Storybook Environment Report

## Status

${environment.status}

## Package Manager

${environment.packageManager}

## Detected Dependencies

${markdownList(environment.dependencies.map((dependency) => `\`${dependency}\``))}

## Detected Scripts

${markdownList(scripts)}

## Detected Config Files

${markdownList(environment.configFiles.map((filePath) => `\`${filePath}\``))}

## Existing Story Files

${markdownList(environment.storyFiles.map((filePath) => `\`${filePath}\``))}

## Detected Frameworks

${markdownList(environment.frameworks)}

## Detected Commands

${markdownList(environment.commands.map((command) => `\`${command.command}\` (${command.kind})`))}

## Missing Setup

${markdownList(environment.missingSetup)}
`;
}

function stateFromExport(exportName: string): string | undefined {
  const normalized = exportName.replace(/[_\s-]+/g, "").toLowerCase();
  const pairs: Array<[RegExp, string]> = [
    [/^(default|primary|basic|standard)$/, "default"],
    [/load|pending|skeleton/, "loading"],
    [/error|fail/, "error"],
    [/empty|noresults|nodata/, "empty"],
    [/disabled/, "disabled"],
    [/success|complete/, "success"],
    [/permissiondenied|forbidden|unauthorized|noaccess/, "permission denied"],
    [/mobile|responsive|smallviewport/, "mobile/responsive"]
  ];
  return pairs.find(([pattern]) => pattern.test(normalized))?.[1];
}

function storyDecoratorsOrProviders(source: string): string[] {
  const matches = new Set<string>();
  const checks: Array<[RegExp, string]> = [
    [/\bdecorators?\b/, "decorators"],
    [/\b(?:MemoryRouter|BrowserRouter|RouterProvider)\b/, "router provider"],
    [/\b(?:QueryClientProvider|ApolloProvider|Provider)\b/, "data/state provider"],
    [/\b(?:IntlProvider|I18nextProvider)\b/, "localization provider"],
    [/\b(?:msw|handlers|mockServiceWorker)\b/i, "network mocks"],
    [/\b(?:ThemeProvider|withTheme)\b/, "theme provider"]
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(source)) {
      matches.add(label);
    }
  }
  return [...matches];
}

export async function analyzeExistingStories(
  repository: string,
  environment?: StorybookEnvironment
): Promise<StoryConventionAnalysis> {
  const detected = environment ?? (await detectStorybookEnvironment(repository));
  const stories = await Promise.all(
    detected.storyFiles.map(async (storyPath): Promise<ExistingStory> => {
      const source = await readFile(path.join(repository, storyPath), "utf8");
      const exports = [...source.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)].map(
        (match) => match[1] as string
      );
      const states = new Set(
        exports.map(stateFromExport).filter((state): state is string => Boolean(state))
      );
      if (exports.length > 0 && !states.has("default")) {
        states.add("default");
      }
      return {
        path: storyPath,
        title: source.match(/\btitle\s*:\s*["'`]([^"'`]+)["'`]/)?.[1],
        exports,
        states: [...states],
        imports: [...source.matchAll(/\bfrom\s+["'`]([^"'`]+)["'`]/g)].map(
          (match) => match[1] as string
        ),
        decoratorsOrProviders: storyDecoratorsOrProviders(source)
      };
    })
  );
  const conventions = new Set<string>();
  if (stories.some((story) => story.path.startsWith("stories/"))) {
    conventions.add("centralized stories/ directory");
  }
  if (stories.some((story) => story.path.startsWith("src/"))) {
    conventions.add("src/ co-located stories");
  }
  for (const story of stories) {
    const match = story.path.match(/\.stories\.([^.\/]+)$/);
    if (match?.[1]) {
      conventions.add(`*.stories.${match[1]}`);
    } else if (story.path.endsWith(".mdx")) {
      conventions.add("*.mdx");
    }
  }
  return {
    stories,
    conventions: [...conventions].sort(),
    decoratorsOrProviders: [
      ...new Set(stories.flatMap((story) => story.decoratorsOrProviders))
    ].sort()
  };
}

function isUiComponentPath(filePath: string): boolean {
  return (
    /\.(tsx|jsx|vue|svelte)$/.test(filePath) &&
    !/\.(stories|story|test|spec)\.[^/]+$/.test(filePath) &&
    !/(^|\/)(__tests__|tests)\//.test(filePath)
  );
}

function componentNameFor(filePath: string): string {
  return path.basename(filePath).replace(/\.[^.]+$/, "");
}

function detectComponentExport(
  source: string,
  expectedName: string
): ComponentExport | undefined {
  const defaultNamed = source.match(
    /export\s+default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)/
  )?.[1];
  if (defaultNamed) {
    return { name: defaultNamed, kind: "default" };
  }
  if (
    new RegExp(
      `export\\s+default\\s+${expectedName.replace(/[$]/g, "\\$&")}\\b`
    ).test(source)
  ) {
    return { name: expectedName, kind: "default" };
  }
  const namedExports = [
    ...source.matchAll(
      /export\s+(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
    )
  ].map((match) => match[1] as string);
  const preferred =
    namedExports.find((name) => name === expectedName) ?? namedExports[0];
  return preferred ? { name: preferred, kind: "named" } : undefined;
}

function propTypeName(source: string, componentName: string): string | undefined {
  const patterns = [
    new RegExp(
      `(?:function\\s+${componentName}|const\\s+${componentName}\\s*=)[\\s\\S]{0,160}?\\}\\s*:\\s*([A-Za-z_$][\\w$]*)`
    ),
    new RegExp(
      `(?:function\\s+${componentName}|const\\s+${componentName}\\s*=)[\\s\\S]{0,160}?\\bprops\\s*:\\s*([A-Za-z_$][\\w$]*)`
    ),
    new RegExp(`\\b${componentName}\\s*:\\s*(?:React\\.)?FC<([A-Za-z_$][\\w$]*)>`)
  ];
  return patterns.map((pattern) => source.match(pattern)?.[1]).find(Boolean);
}

function requiredProps(source: string, componentName: string): string[] {
  const candidateNames = [
    propTypeName(source, componentName),
    `${componentName}Props`,
    "Props"
  ].filter((value): value is string => Boolean(value));
  for (const typeName of candidateNames) {
    const escaped = typeName.replace(/[$]/g, "\\$&");
    const body =
      source.match(new RegExp(`interface\\s+${escaped}\\s*{([\\s\\S]*?)}`))?.[1] ??
      source.match(new RegExp(`type\\s+${escaped}\\s*=\\s*{([\\s\\S]*?)}`))?.[1];
    if (!body) {
      continue;
    }
    return body
      .split(/[;\n]/)
      .map((line) => line.trim())
      .map((line) => line.match(/^([A-Za-z_$][\w$]*)(\?)?\s*:/))
      .filter(
        (
          match
        ): match is RegExpMatchArray & { 1: string; 2: string | undefined } =>
          Boolean(match?.[1])
      )
      .filter((match) => !match[2] && match[1] !== "children")
      .map((match) => match[1]);
  }
  return [];
}

function inferRelevantStates(source: string, contextText: string): string[] {
  const text = `${source}\n${contextText}`;
  const states = ["default"];
  const checks: Array<[RegExp, string]> = [
    [/\b(loading|pending|skeleton|isLoading)\b|로딩/i, "loading"],
    [/\b(error|failed|failure|hasError)\b|오류|실패/i, "error"],
    [/\b(empty|no results|no data)\b|빈 상태|결과 없음/i, "empty"],
    [/\b(disabled|isDisabled)\b|비활성/i, "disabled"],
    [/\b(success|succeeded|complete)\b|성공|완료/i, "success"],
    [
      /\b(permission denied|forbidden|unauthorized|no access)\b|권한 없음|접근 거부/i,
      "permission denied"
    ],
    [/\b(mobile|responsive|viewport|breakpoint)\b|모바일|반응형/i, "mobile/responsive"]
  ];
  for (const [pattern, state] of checks) {
    if (pattern.test(text)) {
      states.push(state);
    }
  }
  return [...new Set(states)];
}

function storyMatchesComponent(story: ExistingStory, componentPath: string): boolean {
  const componentBase = componentNameFor(componentPath).toLowerCase();
  const storyBase = path.basename(story.path).split(".stories.")[0]?.toLowerCase();
  if (storyBase === componentBase) {
    return true;
  }
  return story.imports.some((importPath) => {
    const importedBase = path.basename(importPath).toLowerCase();
    return importedBase === componentBase;
  });
}

export async function identifyChangedUiComponents(
  context: StorybookContext,
  repository: string,
  stories: StoryConventionAnalysis
): Promise<ChangedUiComponent[]> {
  const contextText = [
    context.inputs.diffSummary,
    context.inputs.implementationSummary,
    context.inputs.taskSpec ?? "",
    context.inputs.userImplementationIntent ?? ""
  ].join("\n");
  const components: ChangedUiComponent[] = [];
  for (const changedFile of context.inputs.changedFilesArtifact.changedFiles) {
    const filePath = normalizePath(changedFile.path);
    if (!isUiComponentPath(filePath) || changedFile.changeType === "deleted") {
      continue;
    }
    const absolutePath = path.join(repository, filePath);
    if (!(await pathExists(absolutePath))) {
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    const componentName = componentNameFor(filePath);
    components.push({
      path: filePath,
      source,
      componentName,
      componentExport: detectComponentExport(source, componentName),
      requiredProps: requiredProps(source, componentName),
      relevantStates: inferRelevantStates(source, contextText),
      existingStoryPaths: stories.stories
        .filter((story) => storyMatchesComponent(story, filePath))
        .map((story) => story.path)
    });
  }
  return components;
}

function storyExtension(componentPath: string): string {
  const extension = path.extname(componentPath).slice(1);
  return extension === "tsx" || extension === "jsx" ? extension : "ts";
}

function targetStoryPath(
  componentPath: string,
  conventions: StoryConventionAnalysis,
  existingStory?: ExistingStory
): string {
  if (existingStory) {
    return existingStory.path;
  }
  const extension = storyExtension(componentPath);
  const base = componentNameFor(componentPath);
  const usesCentralStories =
    conventions.stories.length > 0 &&
    conventions.stories.every((story) => story.path.startsWith("stories/"));
  if (usesCentralStories) {
    const relativeSource = componentPath.replace(/^src\//, "");
    return normalizePath(
      path.join(
        "stories",
        path.dirname(relativeSource),
        `${base}.stories.${extension}`
      )
    );
  }
  return normalizePath(
    path.join(path.dirname(componentPath), `${base}.stories.${extension}`)
  );
}

function requiredMocksOrProviders(
  component: ChangedUiComponent,
  conventions: StoryConventionAnalysis
): string[] {
  const requirements = new Set<string>();
  if (component.requiredProps.length > 0) {
    requirements.add(`Required props: ${component.requiredProps.join(", ")}`);
  }
  const sourceChecks: Array<[RegExp, string]> = [
    [/\b(useRouter|usePathname|useSearchParams|Link)\b/, "router context"],
    [/\b(useQuery|useMutation|QueryClient)\b/, "data query provider or mocks"],
    [/\b(useContext|Provider)\b/, "component context provider"],
    [/\b(useTranslation|useIntl)\b/, "localization provider"],
    [/\b(fetch|axios|graphql|request)\b/i, "deterministic network mocks"],
    [/\b(useTheme|ThemeProvider)\b/, "theme provider"]
  ];
  for (const [pattern, label] of sourceChecks) {
    if (pattern.test(component.source)) {
      requirements.add(label);
    }
  }
  for (const provider of conventions.decoratorsOrProviders) {
    requirements.add(`Reuse existing ${provider}`);
  }
  return [...requirements];
}

function isReactComponent(
  component: ChangedUiComponent,
  environment: StorybookEnvironment
): boolean {
  return (
    /\.(tsx|jsx)$/.test(component.path) &&
    (environment.frameworks.some((framework) =>
      ["React", "Next.js"].includes(framework)
    ) ||
      /\bfrom\s+["']react["']|\bReact\./.test(component.source))
  );
}

export function createStorybookPlan(
  context: StorybookContext,
  environment: StorybookEnvironment,
  conventions: StoryConventionAnalysis,
  components: ChangedUiComponent[]
): StorybookPlan {
  const actions = components.map((component): StoryPlanAction => {
    const existingStory = conventions.stories.find((story) =>
      component.existingStoryPaths.includes(story.path)
    );
    const existingStates = existingStory?.states ?? [];
    const missingStates = component.relevantStates.filter(
      (state) => !existingStates.includes(state)
    );
    const mocksOrProviders = requiredMocksOrProviders(component, conventions);
    const automaticWriteSupported =
      !existingStory &&
      Boolean(component.componentExport) &&
      component.requiredProps.length === 0 &&
      isReactComponent(component, environment);
    let automaticWriteReason = "Eligible for a conservative new React CSF story.";
    if (existingStory) {
      automaticWriteReason =
        "Existing stories require context-aware manual updates; automatic append is disabled.";
    } else if (!component.componentExport) {
      automaticWriteReason = "A usable component export could not be identified.";
    } else if (component.requiredProps.length > 0) {
      automaticWriteReason =
        "Required props need explicit approved fixtures before writing a story.";
    } else if (!isReactComponent(component, environment)) {
      automaticWriteReason =
        "Automatic writing currently supports simple React or Next.js components only.";
    }
    return {
      componentPath: component.path,
      componentName: component.componentName,
      storyPath: targetStoryPath(component.path, conventions, existingStory),
      changeType: existingStory ? "update" : "add",
      requiredStates: component.relevantStates,
      existingStates,
      missingStates,
      requiredMocksOrProviders: mocksOrProviders,
      automaticWriteSupported,
      automaticWriteReason,
      componentExport: component.componentExport
    };
  });

  return {
    ticketKey: context.ticketKey,
    components,
    actions,
    suggestedCommands: environment.commands
      .filter((command) => command.kind !== "dev")
      .map((command) => command.command),
    nonGoals: [
      "Do not redesign components or change product behavior for Storybook.",
      "Do not add dependencies or setup without explicit approval.",
      "Do not run browser scenario verification, commit, push, or create a PR."
    ]
  };
}

async function renderTemplate(
  fileName: string,
  values: Record<string, string>
): Promise<string> {
  let template = await readFile(path.join(resourcesDir, fileName), "utf8");
  for (const [key, value] of Object.entries(values)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return `${template.trimEnd()}\n`;
}

export async function renderStorybookSetupProposal(
  environment: StorybookEnvironment
): Promise<string> {
  const detected = [
    `Status: ${environment.status}`,
    `Package manager: ${environment.packageManager}`,
    `Dependencies: ${environment.dependencies.join(", ") || "none"}`,
    `Config files: ${environment.configFiles.join(", ") || "none"}`,
    `Scripts: ${Object.keys(environment.scripts).join(", ") || "none"}`
  ];
  return renderTemplate("storybook-setup-proposal-template.md", {
    detectedStorybookEnvironment: markdownList(detected)
  });
}

export function renderStorybookPlan(
  plan: StorybookPlan,
  conventions: StoryConventionAnalysis
): string {
  const changedUiComponents = plan.components.map(
    (component) =>
      `\`${component.path}\` (${component.relevantStates.join(", ")})`
  );
  const existingStories = plan.components.flatMap((component) =>
    component.existingStoryPaths.length > 0
      ? component.existingStoryPaths.map(
          (storyPath) => `\`${component.path}\` → \`${storyPath}\``
        )
      : [`\`${component.path}\`: no existing story`]
  );
  const storiesToAddOrUpdate = plan.actions.map(
    (action) =>
      `${action.changeType}: \`${action.storyPath}\` for \`${action.componentPath}\`; missing states: ${
        action.missingStates.join(", ") || "none"
      }; ${action.automaticWriteReason}`
  );
  const componentStates = plan.components.map(
    (component) =>
      `\`${component.componentName}\`: ${component.relevantStates.join(", ")}`
  );
  const mocks = [
    ...plan.actions.flatMap((action) =>
      action.requiredMocksOrProviders.map(
        (requirement) => `\`${action.componentName}\`: ${requirement}`
      )
    ),
    ...conventions.decoratorsOrProviders.map(
      (provider) => `Existing convention: ${provider}`
    )
  ];
  return `# Storybook Plan
## Ticket
${plan.ticketKey}
## Changed UI Components
${markdownList(changedUiComponents)}
## Existing Stories
${markdownList(existingStories)}
## Stories To Add or Update
${markdownList(storiesToAddOrUpdate)}
## Component States
${markdownList(componentStates)}
## Required Mocks or Providers
${markdownList([...new Set(mocks)])}
## Suggested Storybook Commands
${markdownList(plan.suggestedCommands.map((command) => `\`${command}\``))}
## Non-goals
${markdownList(plan.nonGoals)}
`;
}

function defaultSetupCommand(environment: StorybookEnvironment): string {
  if (environment.packageManager === "pnpm") {
    return "pnpm dlx storybook@latest init --yes";
  }
  if (environment.packageManager === "yarn") {
    return "yarn dlx storybook@latest init --yes";
  }
  return "npx storybook@latest init --yes";
}

function isSetupTrackedFile(filePath: string): boolean {
  return (
    /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(
      filePath
    ) ||
    filePath.startsWith(".storybook/") ||
    /\.stories\.[^/]+$/.test(filePath) ||
    /^(src|stories)\/.*\.mdx$/.test(filePath)
  );
}

async function fileFingerprint(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function setupSnapshot(repository: string): Promise<Map<string, string>> {
  const files = (await walkFiles(repository)).filter(isSetupTrackedFile);
  return new Map(
    await Promise.all(
      files.map(
        async (filePath): Promise<[string, string]> => [
          filePath,
          await fileFingerprint(path.join(repository, filePath))
        ]
      )
    )
  );
}

function changedSnapshotFiles(
  before: Map<string, string>,
  after: Map<string, string>
): string[] {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((filePath) => before.get(filePath) !== after.get(filePath))
    .sort();
}

export async function executeStorybookSetup(options: {
  context: StorybookContext;
  repository: string;
  environment: StorybookEnvironment;
  setupCommand?: string;
  timeoutMs: number;
}): Promise<StorybookSetupResult> {
  const command = options.setupCommand ?? defaultSetupCommand(options.environment);
  const before = await setupSnapshot(options.repository);
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let status: StorybookSetupResult["status"] = "passed";
  let errorMessage: string | undefined;
  try {
    const result = await execFileAsync("/bin/sh", ["-lc", command], {
      cwd: options.repository,
      encoding: "utf8",
      timeout: options.timeoutMs,
      maxBuffer: 20 * 1024 * 1024
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    status = "failed";
    const failure = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    stdout = failure.stdout ?? "";
    stderr = failure.stderr ?? "";
    errorMessage = failure.message ?? "Storybook setup command failed.";
  }
  const after = await setupSnapshot(options.repository);
  const changedFiles = changedSnapshotFiles(before, after);
  await mkdir(path.join(options.context.runDir, "logs"), { recursive: true });
  await writeFile(
    path.join(options.context.runDir, "logs/storybook-setup.log"),
    `Command: ${command}
Approved: yes
Status: ${status}
Duration ms: ${Date.now() - startedAt}

STDOUT
${stdout}

STDERR
${stderr}
${errorMessage ? `\nERROR\n${errorMessage}\n` : ""}`,
    "utf8"
  );
  const result: StorybookSetupResult = {
    approved: true,
    command,
    status,
    changedFiles,
    ...(errorMessage ? { error: errorMessage } : {})
  };
  await writeJsonFile(
    path.join(options.context.runDir, "logs"),
    "storybook-setup.json",
    result
  );
  return result;
}

function importPathForStory(storyPath: string, componentPath: string): string {
  const relative = normalizePath(
    path.relative(path.dirname(storyPath), componentPath)
  ).replace(/\.[^.]+$/, "");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function stateExportName(state: string): string {
  return state
    .split(/[\s/.-]+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function stateArgs(source: string, state: string): string | undefined {
  const candidates: Record<string, Array<[RegExp, string]>> = {
    loading: [
      [/\bisLoading\??\s*:/, "{ isLoading: true }"],
      [/\bloading\??\s*:/, "{ loading: true }"],
      [/\bstatus\??\s*:/, '{ status: "loading" }']
    ],
    error: [
      [/\bhasError\??\s*:/, "{ hasError: true }"],
      [/\berror\??\s*:/, '{ error: "Storybook error state" }'],
      [/\bstatus\??\s*:/, '{ status: "error" }']
    ],
    empty: [
      [/\bitems\??\s*:/, "{ items: [] }"],
      [/\bdata\??\s*:/, "{ data: [] }"],
      [/\bresults\??\s*:/, "{ results: [] }"],
      [/\brows\??\s*:/, "{ rows: [] }"],
      [/\boptions\??\s*:/, "{ options: [] }"]
    ],
    disabled: [
      [/\bisDisabled\??\s*:/, "{ isDisabled: true }"],
      [/\bdisabled\??\s*:/, "{ disabled: true }"]
    ],
    success: [
      [/\bsuccess\??\s*:/, "{ success: true }"],
      [/\bstatus\??\s*:/, '{ status: "success" }']
    ],
    "permission denied": [
      [/\bcanAccess\??\s*:/, "{ canAccess: false }"],
      [/\bisAllowed\??\s*:/, "{ isAllowed: false }"],
      [/\bpermission\??\s*:/, '{ permission: "denied" }']
    ]
  };
  return candidates[state]?.find(([pattern]) => pattern.test(source))?.[1];
}

function storyTitle(componentPath: string, componentName: string): string {
  const directory = path.dirname(componentPath).replace(/^src\/?/, "");
  return [directory === "." ? "" : directory, componentName]
    .filter(Boolean)
    .join("/");
}

function renderNewReactStory(
  action: StoryPlanAction,
  component: ChangedUiComponent
): { content: string; states: string[] } {
  if (!action.componentExport) {
    throw new Error(`No component export is available for ${action.componentPath}.`);
  }
  const importPath = importPathForStory(action.storyPath, action.componentPath);
  const componentImport =
    action.componentExport.kind === "default"
      ? `import ${action.componentExport.name} from "${importPath}";`
      : `import { ${action.componentExport.name} } from "${importPath}";`;
  const stories: string[] = ["export const Default: Story = {};"];
  const writtenStates = ["default"];
  for (const state of action.requiredStates.filter((item) => item !== "default")) {
    const exportName = stateExportName(state);
    if (state === "mobile/responsive") {
      stories.push(`export const ${exportName}: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    }
  }
};`);
      writtenStates.push(state);
      continue;
    }
    const args = stateArgs(component.source, state);
    if (args) {
      stories.push(`export const ${exportName}: Story = {
  args: ${args}
};`);
      writtenStates.push(state);
    }
  }
  return {
    content: `import type { Meta, StoryObj } from "@storybook/react";
${componentImport}

const meta = {
  title: "${storyTitle(action.componentPath, action.componentName)}",
  component: ${action.componentExport.name}
} satisfies Meta<typeof ${action.componentExport.name}>;

export default meta;

type Story = StoryObj<typeof meta>;

${stories.join("\n\n")}
`,
    states: writtenStates
  };
}

async function appendChangedFiles(
  context: StorybookContext,
  files: Array<{
    path: string;
    changeType: string;
    reason: string;
  }>
): Promise<void> {
  const existing = context.inputs.changedFilesArtifact.changedFiles;
  for (const file of files) {
    const normalized = normalizePath(file.path);
    const current = existing.find(
      (changedFile) => normalizePath(changedFile.path) === normalized
    );
    if (current) {
      current.changeType = current.changeType ?? file.changeType;
      current.reason = current.reason ?? file.reason;
    } else {
      existing.push({
        path: normalized,
        changeType: file.changeType,
        reason: file.reason
      });
    }
  }
  await writeJsonFile(context.runDir, "changed-files.json", {
    ...context.inputs.changedFilesArtifact,
    changedFiles: existing
  });
}

export async function recordApprovedSetupChanges(
  context: StorybookContext,
  setup: StorybookSetupResult
): Promise<void> {
  await appendChangedFiles(
    context,
    setup.changedFiles.map((filePath) => ({
      path: filePath,
      changeType: "modified",
      reason: "Approved Storybook setup change."
    }))
  );
}

export async function writeApprovedStories(options: {
  context: StorybookContext;
  repository: string;
  plan: StorybookPlan;
}): Promise<StoryWriteResult> {
  const stories: StoryChange[] = [];
  const skipped: string[] = [];
  for (const action of options.plan.actions) {
    if (action.missingStates.length === 0) {
      continue;
    }
    if (!action.automaticWriteSupported) {
      skipped.push(`\`${action.storyPath}\`: ${action.automaticWriteReason}`);
      continue;
    }
    const target = path.join(options.repository, action.storyPath);
    if (await pathExists(target)) {
      skipped.push(
        `\`${action.storyPath}\`: target already exists and requires a manual update.`
      );
      continue;
    }
    const component = options.plan.components.find(
      (item) => item.path === action.componentPath
    );
    if (!component) {
      skipped.push(`\`${action.componentPath}\`: component analysis is unavailable.`);
      continue;
    }
    const rendered = renderNewReactStory(action, component);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, rendered.content, "utf8");
    stories.push({
      path: action.storyPath,
      changeType: "added",
      states: rendered.states,
      reason: `Add approved Storybook coverage for ${action.componentName}.`
    });
  }
  if (stories.length > 0) {
    await writeJsonFile(options.context.runDir, "stories-changed.json", {
      ticketKey: options.context.ticketKey,
      stories
    });
    await appendChangedFiles(
      options.context,
      stories.map((story) => ({
        path: story.path,
        changeType: story.changeType,
        reason: story.reason
      }))
    );
  }
  return { stories, skipped };
}

function commandInvocation(
  packageManager: PackageManager,
  scriptName: string
): { executable: string; args: string[] } {
  if (packageManager === "pnpm") {
    return { executable: "pnpm", args: [scriptName] };
  }
  if (packageManager === "yarn") {
    return { executable: "yarn", args: [scriptName] };
  }
  return { executable: "npm", args: ["run", scriptName] };
}

export async function runStorybookChecks(options: {
  context: StorybookContext;
  repository: string;
  environment: StorybookEnvironment;
  timeoutMs: number;
}): Promise<StorybookCheckSummary> {
  const commands = options.environment.commands.filter(
    (
      command
    ): command is StorybookCommand & {
      kind: Exclude<StorybookCommandKind, "dev">;
    } => command.kind !== "dev"
  );
  const logsDir = path.join(options.context.runDir, "logs");
  await mkdir(logsDir, { recursive: true });
  if (commands.length === 0) {
    const summary: StorybookCheckSummary = {
      status: "skipped",
      attempts: [],
      skippedReason:
        "No Storybook build, test-storybook, or chromatic script is configured."
    };
    await writeFile(
      path.join(logsDir, "storybook.log"),
      `Status: skipped\nReason: ${summary.skippedReason}\n`,
      "utf8"
    );
    await writeJsonFile(logsDir, "storybook-checks.json", summary);
    return summary;
  }

  const attempts: StorybookCheckAttempt[] = [];
  const logSections: string[] = [];
  for (const command of commands) {
    const invocation = commandInvocation(
      options.environment.packageManager,
      command.scriptName
    );
    const startedAt = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let status: StorybookCheckAttempt["status"] = "passed";
    try {
      const result = await execFileAsync(invocation.executable, invocation.args, {
        cwd: options.repository,
        encoding: "utf8",
        timeout: options.timeoutMs,
        maxBuffer: 20 * 1024 * 1024
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      status = "failed";
      const failure = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        killed?: boolean;
        signal?: string;
        message?: string;
      };
      stdout = failure.stdout ?? "";
      stderr = `${failure.stderr ?? ""}${
        failure.message ? `\n${failure.message}` : ""
      }`;
      exitCode =
        typeof failure.code === "number" ? failure.code : failure.killed ? 124 : 1;
    }
    const attempt: StorybookCheckAttempt = {
      kind: command.kind,
      command: command.command,
      status,
      exitCode,
      durationMs: Date.now() - startedAt
    };
    attempts.push(attempt);
    logSections.push(`Command: ${command.command}
Kind: ${command.kind}
Status: ${status}
Exit code: ${exitCode}
Duration ms: ${attempt.durationMs}

STDOUT
${stdout}

STDERR
${stderr}`);
    if (status === "failed") {
      break;
    }
  }
  const summary: StorybookCheckSummary = {
    status: attempts.some((attempt) => attempt.status === "failed")
      ? "failed"
      : "passed",
    attempts
  };
  await writeFile(
    path.join(logsDir, "storybook.log"),
    `${logSections.join("\n\n---\n\n")}\n`,
    "utf8"
  );
  await writeJsonFile(logsDir, "storybook-checks.json", summary);
  return summary;
}

async function readStoryChanges(context: StorybookContext): Promise<StoryChange[]> {
  const filePath = path.join(context.runDir, "stories-changed.json");
  if (!(await pathExists(filePath))) {
    const derived = context.inputs.changedFilesArtifact.changedFiles
      .filter((file) => isConfiguredStoryPath(normalizePath(file.path)))
      .map(
        (file): StoryChange => ({
          path: normalizePath(file.path),
          changeType: file.changeType === "added" ? "added" : "modified",
          states: [],
          reason: file.reason ?? "Approved Storybook story change."
        })
      );
    if (derived.length > 0) {
      await writeJsonFile(context.runDir, "stories-changed.json", {
        ticketKey: context.ticketKey,
        stories: derived
      });
    }
    return derived;
  }
  try {
    const artifact = JSON.parse(await readFile(filePath, "utf8")) as {
      stories?: StoryChange[];
    };
    return Array.isArray(artifact.stories) ? artifact.stories : [];
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }
}

async function readSetupResult(
  runDir: string
): Promise<StorybookSetupResult | undefined> {
  const filePath = path.join(runDir, "logs/storybook-setup.json");
  if (!(await pathExists(filePath))) {
    return undefined;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as StorybookSetupResult;
}

async function readCheckSummary(
  runDir: string
): Promise<StorybookCheckSummary | undefined> {
  const filePath = path.join(runDir, "logs/storybook-checks.json");
  if (!(await pathExists(filePath))) {
    return undefined;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as StorybookCheckSummary;
}

function replaceMarkdownSection(
  markdown: string,
  heading: string,
  body: string
): string {
  const lines = markdown.trimEnd().split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const start = lines.findIndex((line) => line.trim() === headingLine);
  if (start === -1) {
    return `${markdown.trimEnd()}\n\n${headingLine}\n\n${body.trim()}\n`;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }
  return [
    ...lines.slice(0, start),
    headingLine,
    "",
    body.trim(),
    ...lines.slice(end)
  ]
    .join("\n")
    .trimEnd() + "\n";
}

function reportStatus(options: {
  environment: StorybookEnvironment;
  plan?: StorybookPlan;
  checks?: StorybookCheckSummary;
  skipInstall: boolean;
}): StorybookStatus {
  if (options.environment.status !== "configured") {
    return options.skipInstall ? "skipped" : "approval-required";
  }
  if (!options.plan || options.plan.components.length === 0) {
    return "skipped";
  }
  if (options.checks?.status === "failed") {
    return "failed";
  }
  if (options.plan.actions.some((action) => action.missingStates.length > 0)) {
    return "approval-required";
  }
  if (options.checks?.status === "passed") {
    return "passed";
  }
  return "skipped";
}

function prExecutionImpact(status: StorybookStatus): string {
  const values: Record<StorybookStatus, string> = {
    passed: "PR execution may continue after remaining required checks.",
    failed: "PR execution must stop until Storybook issues are resolved.",
    "approval-required":
      "PR execution must stop until the user approves setup, story work, or skip.",
    skipped:
      "PR execution requires user confirmation if Storybook is considered required for this ticket."
  };
  return values[status];
}

function environmentSummary(environment: StorybookEnvironment): string[] {
  return [
    `Status: ${environment.status}`,
    `Frameworks: ${environment.frameworks.join(", ") || "unknown"}`,
    `Dependencies: ${environment.dependencies.join(", ") || "none"}`,
    `Config files: ${environment.configFiles.join(", ") || "none"}`,
    `Runnable checks: ${
      environment.commands
        .filter((command) => command.kind !== "dev")
        .map((command) => command.command)
        .join(", ") || "none"
    }`
  ];
}

export async function generateStorybookReport(options: {
  context: StorybookContext;
  environment: StorybookEnvironment;
  plan?: StorybookPlan;
  checks?: StorybookCheckSummary;
  skipInstall: boolean;
  writeResult?: StoryWriteResult;
  statusOverride?: StorybookStatus;
}): Promise<{ status: StorybookStatus; content: string }> {
  const storyChanges = await readStoryChanges(options.context);
  const setup = await readSetupResult(options.context.runDir);
  const status = options.statusOverride ?? reportStatus(options);
  const components =
    options.plan?.components.map((component) => `\`${component.path}\``) ?? [];
  const coveredStates =
    options.plan?.actions.flatMap((action) =>
      action.requiredStates
        .filter((state) => !action.missingStates.includes(state))
        .map((state) => `\`${action.componentName}\`: ${state}`)
    ) ?? [];
  const checks =
    options.checks?.attempts.map(
      (attempt) =>
        `\`${attempt.command}\`: ${attempt.status} (${attempt.durationMs} ms)`
    ) ?? [];
  const skippedItems = [
    ...(options.skipInstall && options.environment.status !== "configured"
      ? ["Storybook installation was skipped by explicit user choice."]
      : []),
    ...(options.plan?.components.length === 0
      ? ["No changed UI component was identified."]
      : []),
    ...(options.plan?.actions.flatMap((action) =>
      action.missingStates.length > 0
        ? [
            `\`${action.storyPath}\` still needs: ${action.missingStates.join(", ")}`
          ]
        : []
    ) ?? []),
    ...(options.writeResult?.skipped ?? []),
    ...(options.checks?.skippedReason ? [options.checks.skippedReason] : [])
  ];
  const risks = [
    ...(setup?.changedFiles.length
      ? [
          `Approved Storybook setup changed: ${setup.changedFiles
            .map((filePath) => `\`${filePath}\``)
            .join(", ")}`
        ]
      : []),
    ...(setup?.error ? [`Storybook setup error: ${setup.error}`] : []),
    ...(storyChanges.length > 0
      ? [
          "Story files changed after the initial commit plan; regenerate and validate commit-plan.md and pr-plan.md before execution."
        ]
      : []),
    ...(status === "approval-required"
      ? ["Unapproved or incomplete Storybook work remains."]
      : [])
  ];
  const content = await renderTemplate("storybook-report-template.md", {
    ticketKey: options.context.ticketKey,
    status,
    storybookEnvironmentSummary: markdownList(
      environmentSummary(options.environment)
    ),
    changedUiComponents: markdownList(components),
    storiesAddedOrUpdated: markdownList(
      storyChanges.map(
        (story) =>
          `\`${story.path}\` (${story.changeType}; ${story.states.join(", ")})`
      )
    ),
    componentStatesCovered: markdownList(coveredStates),
    storybookChecks: markdownList(
      checks.length > 0
        ? checks
        : [
            options.checks?.status === "skipped"
              ? "Skipped"
              : "No Storybook check result is available."
          ]
    ),
    skippedItems: markdownList(skippedItems),
    prExecutionImpact: prExecutionImpact(status),
    risksOrNotes: markdownList(risks)
  });
  await writeTextFile(options.context.runDir, "storybook-report.md", content);
  return { status, content };
}

export async function updateStorybookReports(options: {
  context: StorybookContext;
  environment: StorybookEnvironment;
  status: StorybookStatus;
}): Promise<void> {
  const storyChanges = await readStoryChanges(options.context);
  const setup = await readSetupResult(options.context.runDir);
  const artifactNames = [
    "storybook-environment-report.md",
    "storybook-setup-proposal.md",
    "storybook-plan.md",
    "stories-changed.json",
    "storybook-report.md"
  ];
  const artifacts = (
    await Promise.all(
      artifactNames.map(async (fileName) => ({
        fileName,
        exists: await pathExists(path.join(options.context.runDir, fileName))
      }))
    )
  )
    .filter((item) => item.exists)
    .map((item) => item.fileName);

  const prPlanPath = path.join(options.context.runDir, "pr-plan.md");
  if (await pathExists(prPlanPath)) {
    const existing = await readFile(prPlanPath, "utf8");
    let updated = replaceMarkdownSection(
      existing,
      "Storybook Status",
      options.status
    );
    updated = replaceMarkdownSection(
      updated,
      "Storybook PR Gate",
      prExecutionImpact(options.status)
    );
    await writeFile(prPlanPath, updated, "utf8");
  }

  const body = `- Storybook Status: ${options.status}
- Updated at: ${new Date().toISOString()}
- Environment: ${options.environment.status}
- Setup approval: ${
    setup?.approved ? `approved (${setup.status})` : "not granted"
  }

### Generated Artifacts

${markdownList(artifacts)}

### Setup Changes

${markdownList(setup?.changedFiles.map((filePath) => `\`${filePath}\``))}

### Story Changes

${markdownList(
  storyChanges.map(
    (story) =>
      `\`${story.path}\` (${story.changeType}; ${story.states.join(", ")})`
  )
)}

### PR Execution Impact

${prExecutionImpact(options.status)}

### Storybook Verification Boundary

- Do not commit, push, or create a PR.
- Do not inspect GitHub Actions or access production.
- Do not run browser scenario verification in this phase.`;
  await updateAgentRunReportSection(
    options.context.runDir,
    "Storybook Verification",
    body
  );
}

export async function prepareStorybookPlan(options: {
  context: StorybookContext;
  repository: string;
  environment: StorybookEnvironment;
}): Promise<{
  conventions: StoryConventionAnalysis;
  plan: StorybookPlan;
}> {
  const conventions = await analyzeExistingStories(
    options.repository,
    options.environment
  );
  const components = await identifyChangedUiComponents(
    options.context,
    options.repository,
    conventions
  );
  const plan = createStorybookPlan(
    options.context,
    options.environment,
    conventions,
    components
  );
  await writeTextFile(
    options.context.runDir,
    "storybook-plan.md",
    renderStorybookPlan(plan, conventions)
  );
  return { conventions, plan };
}

export async function runStorybookWorkflow(
  options: RunStorybookOptions
): Promise<{
  status: StorybookStatus;
  environment: StorybookEnvironment;
  plan?: StorybookPlan;
  checks?: StorybookCheckSummary;
  writeResult?: StoryWriteResult;
}> {
  let environment = await detectStorybookEnvironment(options.repository);
  await writeTextFile(
    options.context.runDir,
    "storybook-environment-report.md",
    renderStorybookEnvironmentReport(environment)
  );

  if (environment.status !== "configured") {
    await writeTextFile(
      options.context.runDir,
      "storybook-setup-proposal.md",
      await renderStorybookSetupProposal(environment)
    );
    if (options.executeSetup) {
      const setup = await executeStorybookSetup({
        context: options.context,
        repository: options.repository,
        environment,
        setupCommand: options.setupCommand,
        timeoutMs: options.timeoutMs
      });
      await recordApprovedSetupChanges(options.context, setup);
      if (setup.status === "failed") {
        const report = await generateStorybookReport({
          context: options.context,
          environment,
          skipInstall: false,
          statusOverride: "failed"
        });
        await updateStorybookReports({
          context: options.context,
          environment,
          status: "failed"
        });
        return { status: report.status, environment };
      }
      environment = await detectStorybookEnvironment(options.repository);
      await writeTextFile(
        options.context.runDir,
        "storybook-environment-report.md",
        renderStorybookEnvironmentReport(environment)
      );
    }
  }

  if (environment.status !== "configured") {
    const report = await generateStorybookReport({
      context: options.context,
      environment,
      skipInstall: options.skipInstall
    });
    await updateStorybookReports({
      context: options.context,
      environment,
      status: report.status
    });
    return { status: report.status, environment };
  }

  let prepared = await prepareStorybookPlan({
    context: options.context,
    repository: options.repository,
    environment
  });
  let writeResult: StoryWriteResult | undefined;
  if (options.writeStories) {
    writeResult = await writeApprovedStories({
      context: options.context,
      repository: options.repository,
      plan: prepared.plan
    });
    environment = await detectStorybookEnvironment(options.repository);
    await writeTextFile(
      options.context.runDir,
      "storybook-environment-report.md",
      renderStorybookEnvironmentReport(environment)
    );
    prepared = await prepareStorybookPlan({
      context: options.context,
      repository: options.repository,
      environment
    });
  }
  const checks = await runStorybookChecks({
    context: options.context,
    repository: options.repository,
    environment,
    timeoutMs: options.timeoutMs
  });
  const report = await generateStorybookReport({
    context: options.context,
    environment,
    plan: prepared.plan,
    checks,
    skipInstall: false,
    writeResult
  });
  await updateStorybookReports({
    context: options.context,
    environment,
    status: report.status
  });
  return {
    status: report.status,
    environment,
    plan: prepared.plan,
    checks,
    writeResult
  };
}

export async function loadExistingCheckSummary(
  runDir: string
): Promise<StorybookCheckSummary | undefined> {
  return readCheckSummary(runDir);
}
