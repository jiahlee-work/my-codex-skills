#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const SOURCE_EXTENSIONS = [
  ".tsx",
  ".mts",
  ".cts",
  ".ts",
  ".jsx",
  ".mjs",
  ".cjs",
  ".js",
];

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const REQUIRED_DIRECTORIES = [
  "public/assets",
  "src/app",
  "src/types",
  "src/presentation/components",
  "src/presentation/features",
  "src/presentation/layouts",
  "src/presentation/providers",
  "src/application/hooks",
  "src/application/logging",
  "src/application/services",
  "src/infrastructure/apis",
  "src/infrastructure/network",
  "src/infrastructure/utils",
  "src/shared/types",
  "src/shared/constants",
  "src/shared/utils",
  "src/shared/schemas",
  "src/shared/errors",
  "src/shared/guards",
];

const PATH_ALIASES = {
  "@/*": ["./src/*"],
};

const LEGACY_LAYER_ALIASES = new Map([
  ["@application", "@/application"],
  ["@infrastructure", "@/infrastructure"],
  ["@presentation", "@/presentation"],
  ["@shared", "@/shared"],
]);

const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

const ESLINT_IMPORT_REWRITE_PATTERNS = [
  {
    code: "no-relative-import-paths",
    pattern: /["'`]no-relative-import-paths\/no-relative-import-paths["'`]/,
    message:
      "ESLint no-relative-import-paths can rewrite relative import specifiers",
  },
  {
    code: "prefer-alias",
    pattern: /["'`]prefer-alias\/prefer-alias["'`]/,
    message: "ESLint prefer-alias can rewrite import specifiers",
  },
  {
    code: "path-alias",
    pattern: /["'`]path-alias\/(?:no-relative|prefer-alias|enforce)["'`]/,
    message: "ESLint path-alias rules can rewrite import specifiers",
  },
  {
    code: "module-resolver",
    pattern: /["'`]module-resolver\/(?:use-alias|prefer-alias)["'`]/,
    message: "ESLint module-resolver rules can rewrite import specifiers",
  },
  {
    code: "import-path-rewrite",
    pattern: /\b(?:import-path-rewrite|rewrite-import-paths|prefer-absolute-imports)\b/,
    message: "ESLint config appears to contain an import path rewrite rule",
  },
];

const REQUIRED_LAYER_DIRECTORIES = [
  "src/app",
  "src/presentation",
  "src/application",
  "src/infrastructure",
  "src/shared",
];

const LAYER_RULES = {
  app: new Set([
    "app",
    "presentation",
    "application",
    "infrastructure",
    "shared",
  ]),
  presentation: new Set([
    "presentation",
    "application",
    "infrastructure",
    "shared",
  ]),
  application: new Set(["application", "infrastructure", "shared"]),
  infrastructure: new Set(["infrastructure", "shared"]),
  shared: new Set(["shared"]),
};

const APP_ROUTE_FILE_STEMS = new Set([
  "default",
  "error",
  "forbidden",
  "global-error",
  "global-not-found",
  "layout",
  "loading",
  "not-found",
  "page",
  "providers",
  "route",
  "template",
  "unauthorized",
]);

const APP_METADATA_FILE_STEMS = new Set([
  "apple-icon",
  "favicon",
  "icon",
  "manifest",
  "opengraph-image",
  "robots",
  "sitemap",
  "twitter-image",
]);

const APP_ASSET_EXTENSIONS = new Set([
  ".avif",
  ".css",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".otf",
  ".png",
  ".svg",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
]);

function usage() {
  return [
    "Usage: nextjs-layered-architecture <command> [options]",
    "",
    "Commands:",
    "  setup             Create the layered structure and configure the @/* alias",
    "  audit             Audit project structure, app thinness, and boundaries",
    "  boundary-check    Check imports between app and architecture layers",
    "  fix-imports       Rewrite non-canonical imports to @/... imports",
    "",
    "Options:",
    "  --project <path>  Project root. Defaults to the current directory",
    "  --json            Print machine-readable output",
    "  --dry-run         Report setup changes without writing them",
    "  --force           Replace a conflicting alias or rewrite JSONC config",
  ].join("\n");
}

function parseArgs(argv) {
  const command = argv[0];
  const options = {
    project: process.cwd(),
    json: false,
    dryRun: false,
    force: false,
  };

  if (command === "--help" || command === "-h") {
    return { command: "help", options };
  }

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      return { command: "help", options };
    }

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--force") {
      options.force = true;
      continue;
    }

    if (argument === "--project") {
      const project = argv[index + 1];
      if (!project || project.startsWith("--")) {
        throw new Error("--project requires a path");
      }
      options.project = project;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { command, options };
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativePath(root, target) {
  return toPosix(path.relative(root, target)) || ".";
}

function readPackageJson(projectRoot) {
  const packagePath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    return { packagePath, packageJson: null, error: "package.json was not found" };
  }

  try {
    return {
      packagePath,
      packageJson: JSON.parse(fs.readFileSync(packagePath, "utf8")),
      error: null,
    };
  } catch {
    return {
      packagePath,
      packageJson: null,
      error: "package.json is not valid JSON",
    };
  }
}

function hasNextDependency(packageJson) {
  return Boolean(
    packageJson?.dependencies?.next || packageJson?.devDependencies?.next,
  );
}

function validateNextProject(projectRoot) {
  const errors = [];
  const { packagePath, packageJson, error } = readPackageJson(projectRoot);

  if (error) {
    errors.push({
      code: "package-json",
      message: error,
      file: relativePath(projectRoot, packagePath),
    });
    return { errors, packageJson: null };
  }

  if (!hasNextDependency(packageJson)) {
    errors.push({
      code: "next-dependency",
      message: "package.json does not declare the next package",
      file: "package.json",
    });
  }

  return { errors, packageJson };
}

function ensureDirectory(directory, dryRun) {
  if (fs.existsSync(directory)) {
    return false;
  }

  if (!dryRun) {
    fs.mkdirSync(directory, { recursive: true });
  }
  return true;
}

function stripJsonComments(text) {
  let result = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        result += current;
      } else {
        result += " ";
      }
      continue;
    }

    if (blockComment) {
      if (current === "*" && next === "/") {
        result += "  ";
        blockComment = false;
        index += 1;
      } else {
        result += current === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (inString) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === "/" && next === "/") {
      lineComment = true;
      result += "  ";
      index += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      blockComment = true;
      result += "  ";
      index += 1;
      continue;
    }

    result += current;
  }

  return result;
}

function stripTrailingCommas(text) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];

    if (inString) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === ",") {
      let nextIndex = index + 1;
      while (nextIndex < text.length && /\s/.test(text[nextIndex])) {
        nextIndex += 1;
      }
      if (text[nextIndex] === "}" || text[nextIndex] === "]") {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function readJsonConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  try {
    return { data: JSON.parse(raw), usesJsonc: false };
  } catch {
    const normalized = stripTrailingCommas(stripJsonComments(raw));
    try {
      return { data: JSON.parse(normalized), usesJsonc: true };
    } catch {
      throw new Error(`${path.basename(configPath)} is not valid JSON or JSONC`);
    }
  }
}

function hasTypeScriptSignals(projectRoot, packageJson) {
  if (packageJson?.devDependencies?.typescript || packageJson?.dependencies?.typescript) {
    return true;
  }

  const roots = ["src", "app"];
  return roots.some((root) => {
    const directory = path.join(projectRoot, root);
    if (!fs.existsSync(directory)) return false;
    return walkFiles(directory).some((file) =>
      [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(file)),
    );
  });
}

function configureAlias(projectRoot, packageJson, options) {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  const jsconfigPath = path.join(projectRoot, "jsconfig.json");
  let configPath = fs.existsSync(tsconfigPath)
    ? tsconfigPath
    : fs.existsSync(jsconfigPath)
      ? jsconfigPath
      : hasTypeScriptSignals(projectRoot, packageJson)
        ? tsconfigPath
        : jsconfigPath;

  let parsed = readJsonConfig(configPath);
  if (!parsed) {
    parsed = { data: { compilerOptions: {} }, usesJsonc: false };
  }

  const data = parsed.data;
  data.compilerOptions ??= {};
  data.compilerOptions.paths ??= {};

  const conflicts = Object.entries(PATH_ALIASES).filter(
    ([alias, expected]) => {
      const current = data.compilerOptions.paths[alias];
      return (
        current !== undefined &&
        (!Array.isArray(current) ||
          current.length !== expected.length ||
          current.some((value, index) => value !== expected[index]))
      );
    },
  );

  const missingAliases = Object.entries(PATH_ALIASES).filter(
    ([alias]) => data.compilerOptions.paths[alias] === undefined,
  );

  if (conflicts.length === 0 && missingAliases.length === 0) {
    return { updated: null, warning: null };
  }

  if (conflicts.length > 0 && !options.force) {
    const details = conflicts
      .map(
        ([alias]) =>
          `${alias}=${JSON.stringify(data.compilerOptions.paths[alias])}`,
      )
      .join(", ");
    return {
      updated: null,
      warning:
        `${path.basename(configPath)} defines conflicting path aliases: ` +
        `${details}; use --force to replace them`,
    };
  }

  if (parsed.usesJsonc && !options.force) {
    return {
      updated: null,
      warning:
        `${path.basename(configPath)} contains comments or trailing commas; ` +
        "configure the @/* alias manually or use --force to rewrite it as JSON",
    };
  }

  for (const [alias, target] of Object.entries(PATH_ALIASES)) {
    data.compilerOptions.paths[alias] = target;
  }
  if (!options.dryRun) {
    fs.writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`);
  }

  return {
    updated: relativePath(projectRoot, configPath),
    warning: null,
  };
}

function setupProject(options) {
  const projectRoot = path.resolve(options.project);
  const result = {
    command: "setup",
    project: projectRoot,
    created: [],
    updated: [],
    warnings: [],
    errors: [],
    dryRun: options.dryRun,
  };

  const validation = validateNextProject(projectRoot);
  result.errors.push(...validation.errors);

  const rootApp = path.join(projectRoot, "app");
  const srcApp = path.join(projectRoot, "src", "app");
  const rootPages = path.join(projectRoot, "pages");
  const srcPages = path.join(projectRoot, "src", "pages");

  if (fs.existsSync(rootApp)) {
    result.errors.push({
      code: "root-app",
      message:
        "A root app/ directory exists. Move it to src/app intentionally before running setup.",
      file: "app",
    });
  }

  if (
    !fs.existsSync(srcApp) &&
    (fs.existsSync(rootPages) || fs.existsSync(srcPages))
  ) {
    result.errors.push({
      code: "pages-router-only",
      message:
        "A Pages Router directory exists without src/app. Confirm the App Router migration first.",
      file: fs.existsSync(srcPages) ? "src/pages" : "pages",
    });
  }

  if (result.errors.length > 0) {
    return result;
  }

  for (const relativeDirectory of REQUIRED_DIRECTORIES) {
    const directory = path.join(projectRoot, relativeDirectory);
    if (ensureDirectory(directory, options.dryRun)) {
      result.created.push(relativeDirectory);
    }
  }

  try {
    const aliasResult = configureAlias(
      projectRoot,
      validation.packageJson,
      options,
    );
    if (aliasResult.updated) result.updated.push(aliasResult.updated);
    if (aliasResult.warning) result.warnings.push(aliasResult.warning);
  } catch (error) {
    result.errors.push({
      code: "config-parse",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

function walkFiles(directory) {
  const files = [];
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function isSourceFile(filePath) {
  return (
    SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension)) &&
    !filePath.endsWith(".d.ts")
  );
}

function sourceStem(filePath) {
  const extension = SOURCE_EXTENSIONS.find((candidate) =>
    filePath.endsWith(candidate),
  );
  return extension ? path.basename(filePath, extension) : path.basename(filePath);
}

function isAllowedAppFile(filePath) {
  const extension = path.extname(filePath);
  if (APP_ASSET_EXTENSIONS.has(extension)) return true;
  if (extension === ".mdx") {
    return APP_ROUTE_FILE_STEMS.has(path.basename(filePath, extension));
  }
  if (!isSourceFile(filePath)) return false;

  const stem = sourceStem(filePath);
  return (
    APP_ROUTE_FILE_STEMS.has(stem) || APP_METADATA_FILE_STEMS.has(stem)
  );
}

function logicalLineCount(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("//");
    }).length;
}

function isKebabCaseSourceName(filePath) {
  const stem = sourceStem(filePath);
  if (stem === "index") return true;
  return stem
    .split(".")
    .every((part) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part));
}

function findConfigPath(projectRoot) {
  const tsconfig = path.join(projectRoot, "tsconfig.json");
  if (fs.existsSync(tsconfig)) return tsconfig;
  const jsconfig = path.join(projectRoot, "jsconfig.json");
  if (fs.existsSync(jsconfig)) return jsconfig;
  return null;
}

function inspectAlias(projectRoot) {
  const configPath = findConfigPath(projectRoot);
  if (!configPath) {
    return {
      ok: false,
      message: "tsconfig.json or jsconfig.json is missing",
      file: null,
    };
  }

  try {
    const parsed = readJsonConfig(configPath);
    const paths = parsed?.data?.compilerOptions?.paths ?? {};
    const invalidAliases = Object.entries(PATH_ALIASES).filter(
      ([alias, expected]) => {
        const current = paths[alias];
        return (
          !Array.isArray(current) ||
          current.length !== expected.length ||
          current.some((value, index) => value !== expected[index])
        );
      },
    );
    const ok = invalidAliases.length === 0;
    return {
      ok,
      message: ok
        ? null
        : `path aliases must match ${JSON.stringify(PATH_ALIASES)}; invalid aliases: ` +
          invalidAliases.map(([alias]) => alias).join(", "),
      file: relativePath(projectRoot, configPath),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      file: relativePath(projectRoot, configPath),
    };
  }
}

function loadTypeScript(projectRoot) {
  const loaders = [
    createRequire(path.join(projectRoot, "package.json")),
    createRequire(import.meta.url),
  ];

  for (const load of loaders) {
    try {
      return load("typescript");
    } catch {
      // Try the next resolution root.
    }
  }

  throw new Error(
    "typescript is required for AST-based boundary checks; install project dependencies first",
  );
}

function layerOf(projectRoot, filePath) {
  const relative = relativePath(path.join(projectRoot, "src"), filePath);
  if (relative === "." || relative.startsWith("../")) return null;
  const [firstSegment] = relative.split("/");
  return Object.hasOwn(LAYER_RULES, firstSegment) ? firstSegment : null;
}

function collectImportEdges(ts, sourceFile) {
  const edges = [];

  function add(specifier, node) {
    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    edges.push({
      specifier,
      line: position.line + 1,
      column: position.character + 1,
      start: node.getStart(sourceFile),
      end: node.getEnd(),
    });
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression.text, node.moduleReference.expression);
    }

    if (ts.isCallExpression(node)) {
      const [firstArgument] = node.arguments;
      if (firstArgument && ts.isStringLiteral(firstArgument)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          add(firstArgument.text, firstArgument);
        }
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require"
        ) {
          add(firstArgument.text, firstArgument);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

function resolveFile(candidate) {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = `${candidate}${extension}`;
    if (fs.existsSync(withExtension) && fs.statSync(withExtension).isFile()) {
      return withExtension;
    }
  }

  const candidateExtension = path.extname(candidate);
  if (
    [".js", ".jsx", ".mjs", ".cjs"].includes(candidateExtension) &&
    !fs.existsSync(candidate)
  ) {
    const withoutExtension = candidate.slice(0, -candidateExtension.length);
    for (const extension of [".ts", ".tsx", ".mts", ".cts"]) {
      const sourceCandidate = `${withoutExtension}${extension}`;
      if (
        fs.existsSync(sourceCandidate) &&
        fs.statSync(sourceCandidate).isFile()
      ) {
        return sourceCandidate;
      }
    }
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const indexFile = path.join(candidate, `index${extension}`);
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        return indexFile;
      }
    }
  }

  return null;
}

function resolveImport(projectRoot, importerFile, specifier) {
  for (const [aliasPattern, [targetPattern]] of Object.entries(PATH_ALIASES)) {
    const aliasPrefix = aliasPattern.slice(0, -1);
    if (!specifier.startsWith(aliasPrefix)) continue;

    const targetPrefix = targetPattern.slice(0, -1);
    const suffix = specifier.slice(aliasPrefix.length);
    return resolveFile(path.resolve(projectRoot, targetPrefix, suffix));
  }

  if (specifier.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(importerFile), specifier));
  }

  return null;
}

function isDeepRelativeImport(specifier) {
  return /^(?:\.\.\/){2,}/.test(specifier);
}

function isWithinDirectory(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveAliasReplacement(projectRoot, importerFile, specifier) {
  if (!isDeepRelativeImport(specifier)) return null;
  if (specifier.includes("?") || specifier.includes("#")) return null;

  const sourceRoot = path.join(projectRoot, "src");
  const rawTarget = path.resolve(path.dirname(importerFile), specifier);
  const importedFile = resolveFile(rawTarget);
  if (!importedFile || !isWithinDirectory(sourceRoot, importedFile)) return null;

  const aliasTarget = rawTarget;
  const aliasPath = relativePath(sourceRoot, aliasTarget);
  if (aliasPath === "." || aliasPath.startsWith("../")) return null;

  return `@/${aliasPath}`;
}

function resolveLegacyLayerAliasReplacement(specifier) {
  for (const [legacyAlias, rootAlias] of LEGACY_LAYER_ALIASES) {
    if (specifier === legacyAlias || specifier.startsWith(`${legacyAlias}/`)) {
      return `${rootAlias}${specifier.slice(legacyAlias.length)}`;
    }
  }

  return null;
}

function resolveImportStyleReplacement(projectRoot, importerFile, specifier) {
  const legacyAliasReplacement = resolveLegacyLayerAliasReplacement(specifier);
  if (legacyAliasReplacement) {
    return {
      code: "non-canonical-layer-import",
      to: legacyAliasReplacement,
    };
  }

  const aliasReplacement = resolveAliasReplacement(
    projectRoot,
    importerFile,
    specifier,
  );
  if (aliasReplacement) {
    return {
      code: "deep-relative-import",
      to: aliasReplacement,
    };
  }

  return null;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function readEslintConfigText(configPath) {
  if (!fs.existsSync(configPath)) return null;

  if (path.basename(configPath) === "package.json") {
    try {
      const packageJson = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (!packageJson.eslintConfig) return null;
      return JSON.stringify(packageJson.eslintConfig, null, 2);
    } catch {
      return null;
    }
  }

  return fs.readFileSync(configPath, "utf8");
}

function findEslintImportRewriteConfig(projectRoot) {
  const configPaths = ESLINT_CONFIG_FILES.map((file) =>
    path.join(projectRoot, file),
  );
  configPaths.push(path.join(projectRoot, "package.json"));

  const findings = [];
  for (const configPath of configPaths) {
    const text = readEslintConfigText(configPath);
    if (!text) continue;

    for (const rule of ESLINT_IMPORT_REWRITE_PATTERNS) {
      const match = text.match(rule.pattern);
      if (!match || match.index === undefined) continue;

      findings.push({
        file: relativePath(projectRoot, configPath),
        line: lineNumberAt(text, match.index),
        code: rule.code,
        message: rule.message,
      });
    }
  }

  return findings;
}

function runBoundaryCheck(projectRoot) {
  const root = path.resolve(projectRoot);
  const ts = loadTypeScript(root);
  const violations = [];

  for (const file of walkFiles(path.join(root, "src"))) {
    if (!isSourceFile(file)) continue;
    const importerLayer = layerOf(root, file);
    if (!importerLayer) continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const extension = path.extname(file);
    const scriptKind =
      extension === ".tsx"
        ? ts.ScriptKind.TSX
        : extension === ".jsx"
          ? ts.ScriptKind.JSX
          : extension === ".js" || extension === ".mjs" || extension === ".cjs"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    for (const edge of collectImportEdges(ts, sourceFile)) {
      const importedFile = resolveImport(root, file, edge.specifier);
      if (!importedFile) continue;
      const importedLayer = layerOf(root, importedFile);
      if (!importedLayer) continue;

      if (!LAYER_RULES[importerLayer].has(importedLayer)) {
        violations.push({
          file: relativePath(root, file),
          line: edge.line,
          column: edge.column,
          specifier: edge.specifier,
          importerLayer,
          importedLayer,
          importedFile: relativePath(root, importedFile),
        });
      }
    }
  }

  return violations;
}

function runImportStyleCheck(projectRoot) {
  const root = path.resolve(projectRoot);
  const ts = loadTypeScript(root);
  const violations = [];

  for (const file of walkFiles(path.join(root, "src"))) {
    if (!isSourceFile(file)) continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const extension = path.extname(file);
    const scriptKind =
      extension === ".tsx"
        ? ts.ScriptKind.TSX
        : extension === ".jsx"
          ? ts.ScriptKind.JSX
          : extension === ".js" || extension === ".mjs" || extension === ".cjs"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    for (const edge of collectImportEdges(ts, sourceFile)) {
      const replacement = resolveImportStyleReplacement(root, file, edge.specifier);
      if (!replacement) continue;

      violations.push({
        file: relativePath(root, file),
        line: edge.line,
        column: edge.column,
        specifier: edge.specifier,
        replacement: replacement.to,
        code: replacement.code,
      });
    }
  }

  return violations;
}

function fixImportsProject(options) {
  const projectRoot = path.resolve(options.project);
  const result = {
    command: "fix-imports",
    project: projectRoot,
    changed: [],
    fixes: [],
    warnings: [],
    errors: [],
    skipped: false,
    dryRun: options.dryRun,
  };

  const eslintImportRewriteConfig = findEslintImportRewriteConfig(projectRoot);
  if (eslintImportRewriteConfig.length > 0 && !options.force) {
    result.skipped = true;
    result.warnings.push({
      code: "eslint-import-rewrite-config",
      message:
        "ESLint import path rewrite settings were found. Skipped fix-imports to avoid save-time conflicts. Use --force to override.",
      matches: eslintImportRewriteConfig,
    });
    return result;
  }

  let ts;
  try {
    ts = loadTypeScript(projectRoot);
  } catch (error) {
    result.errors.push({
      code: "fix-imports-unavailable",
      message: error instanceof Error ? error.message : String(error),
    });
    return result;
  }

  for (const file of walkFiles(path.join(projectRoot, "src"))) {
    if (!isSourceFile(file)) continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const extension = path.extname(file);
    const scriptKind =
      extension === ".tsx"
        ? ts.ScriptKind.TSX
        : extension === ".jsx"
          ? ts.ScriptKind.JSX
          : extension === ".js" || extension === ".mjs" || extension === ".cjs"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const replacements = [];
    for (const edge of collectImportEdges(ts, sourceFile)) {
      const replacement = resolveImportStyleReplacement(
        projectRoot,
        file,
        edge.specifier,
      );
      if (!replacement || replacement.to === edge.specifier) continue;

      replacements.push({
        start: edge.start + 1,
        end: edge.end - 1,
        from: edge.specifier,
        to: replacement.to,
        code: replacement.code,
        line: edge.line,
        column: edge.column,
      });
    }

    if (replacements.length === 0) continue;

    const relativeFile = relativePath(projectRoot, file);
    result.changed.push(relativeFile);
    for (const replacement of replacements) {
      result.fixes.push({
        file: relativeFile,
        line: replacement.line,
        column: replacement.column,
        from: replacement.from,
        to: replacement.to,
        code: replacement.code,
      });
    }

    if (!options.dryRun) {
      let updatedText = sourceText;
      for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
        updatedText =
          updatedText.slice(0, replacement.start) +
          replacement.to +
          updatedText.slice(replacement.end);
      }
      fs.writeFileSync(file, updatedText);
    }
  }

  return result;
}

function auditProject(options) {
  const projectRoot = path.resolve(options.project);
  const findings = [];
  const validation = validateNextProject(projectRoot);

  for (const error of validation.errors) {
    findings.push({ severity: "error", ...error });
  }

  if (fs.existsSync(path.join(projectRoot, "app"))) {
    findings.push({
      severity: "error",
      code: "root-app",
      message: "Use src/app instead of a root app/ directory",
      file: "app",
    });
  }

  for (const directory of REQUIRED_LAYER_DIRECTORIES) {
    if (!fs.existsSync(path.join(projectRoot, directory))) {
      findings.push({
        severity: "error",
        code: "missing-layer",
        message: `Required layer directory is missing: ${directory}`,
        file: directory,
      });
    }
  }

  for (const directory of REQUIRED_DIRECTORIES) {
    if (
      !REQUIRED_LAYER_DIRECTORIES.includes(directory) &&
      !fs.existsSync(path.join(projectRoot, directory))
    ) {
      findings.push({
        severity: "warning",
        code: "missing-recommended-directory",
        message: `Recommended directory is missing: ${directory}`,
        file: directory,
      });
    }
  }

  const alias = inspectAlias(projectRoot);
  if (!alias.ok) {
    findings.push({
      severity: "error",
      code: "path-alias",
      message: alias.message,
      file: alias.file ?? undefined,
    });
  }

  const appRoot = path.join(projectRoot, "src", "app");
  for (const file of walkFiles(appRoot)) {
    if (!isAllowedAppFile(file)) {
      findings.push({
        severity: "error",
        code: "app-owned-code",
        message:
          "src/app may contain only routing boundary files, metadata files, assets, and providers.tsx",
        file: relativePath(projectRoot, file),
      });
      continue;
    }

    if (isSourceFile(file) && logicalLineCount(file) > 80) {
      findings.push({
        severity: "warning",
        code: "thick-app-file",
        message:
          "This App Router boundary file exceeds 80 logical lines; move UI or business logic into its owning layer",
        file: relativePath(projectRoot, file),
      });
    }
  }

  for (const layer of ["application", "infrastructure", "shared"]) {
    const layerRoot = path.join(projectRoot, "src", layer);
    for (const file of walkFiles(layerRoot)) {
      if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
        findings.push({
          severity: "error",
          code: "jsx-outside-presentation",
          message: `${layer} must not own JSX or React UI files`,
          file: relativePath(projectRoot, file),
        });
      }
    }
  }

  for (const layer of [
    "presentation",
    "application",
    "infrastructure",
    "shared",
  ]) {
    for (const file of walkFiles(path.join(projectRoot, "src", layer))) {
      if (isSourceFile(file) && !isKebabCaseSourceName(file)) {
        findings.push({
          severity: "warning",
          code: "source-file-name",
          message: "Use kebab-case for source file names",
          file: relativePath(projectRoot, file),
        });
      }
    }
  }

  let violations = [];
  try {
    violations = runBoundaryCheck(projectRoot);
    for (const violation of violations) {
      findings.push({
        severity: "error",
        code: "layer-boundary",
        message: `${violation.importerLayer} cannot import ${violation.importedLayer}: ${violation.specifier}`,
        file: `${violation.file}:${violation.line}:${violation.column}`,
      });
    }
  } catch (error) {
    findings.push({
      severity: "error",
      code: "boundary-check-unavailable",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    for (const violation of runImportStyleCheck(projectRoot)) {
      const message =
        violation.code === "deep-relative-import"
          ? `Use @/* instead of a deep relative import: ${violation.specifier}`
          : `Use @/... instead of a non-canonical layer import: ${violation.specifier}`;
      findings.push({
        severity: "warning",
        code: violation.code,
        message,
        file: `${violation.file}:${violation.line}:${violation.column}`,
      });
    }
  } catch (error) {
    if (!findings.some((finding) => finding.code === "boundary-check-unavailable")) {
      findings.push({
        severity: "error",
        code: "import-style-check-unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    command: "audit",
    project: projectRoot,
    findings,
    violations,
    errorCount: findings.filter((finding) => finding.severity === "error")
      .length,
    warningCount: findings.filter((finding) => finding.severity === "warning")
      .length,
  };
}

function boundaryCheckProject(options) {
  const projectRoot = path.resolve(options.project);
  try {
    const violations = runBoundaryCheck(projectRoot);
    return {
      command: "boundary-check",
      project: projectRoot,
      violations,
      errors: [],
    };
  } catch (error) {
    return {
      command: "boundary-check",
      project: projectRoot,
      violations: [],
      errors: [
        {
          code: "boundary-check-unavailable",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

function printSetup(result) {
  const action = result.dryRun ? "Would create" : "Created";
  if (result.created.length > 0) {
    console.log(`${action} directories:`);
    for (const directory of result.created) console.log(`- ${directory}`);
  } else {
    console.log("Layer directories already exist.");
  }

  if (result.updated.length > 0) {
    console.log(result.dryRun ? "Would update:" : "Updated:");
    for (const file of result.updated) console.log(`- ${file}`);
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of result.warnings) console.warn(`- ${warning}`);
  }

  if (result.errors.length > 0) {
    console.error("Setup failed:");
    for (const error of result.errors) {
      console.error(`- ${error.file ? `${error.file}: ` : ""}${error.message}`);
    }
  }
}

function printAudit(result) {
  if (result.findings.length === 0) {
    console.log("Architecture audit passed.");
    return;
  }

  console.log(
    `Architecture audit found ${result.errorCount} error(s) and ${result.warningCount} warning(s):`,
  );
  for (const finding of result.findings) {
    const location = finding.file ? `${finding.file}: ` : "";
    console.log(
      `- [${finding.severity}] ${finding.code}: ${location}${finding.message}`,
    );
  }
}

function printBoundary(result) {
  if (result.errors.length > 0) {
    console.error("Boundary check failed:");
    for (const error of result.errors) console.error(`- ${error.message}`);
    return;
  }

  if (result.violations.length === 0) {
    console.log("Architecture boundaries passed.");
    return;
  }

  console.error("Architecture boundary violations found:");
  for (const violation of result.violations) {
    console.error(
      `- ${violation.file}:${violation.line}:${violation.column} ` +
        `${violation.importerLayer} -> ${violation.importedLayer} ` +
        `(${violation.specifier})`,
    );
  }
}

function printFixImports(result) {
  if (result.errors.length > 0) {
    console.error("Import fix failed:");
    for (const error of result.errors) console.error(`- ${error.message}`);
    return;
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of result.warnings) {
      console.warn(`- ${warning.message}`);
      if (warning.matches) {
        for (const match of warning.matches) {
          console.warn(`  - ${match.file}:${match.line} ${match.code}`);
        }
      }
    }
  }

  if (result.skipped) {
    return;
  }

  if (result.fixes.length === 0) {
    console.log("No deep relative imports to fix.");
    return;
  }

  console.log(result.dryRun ? "Would rewrite imports:" : "Rewrote imports:");
  for (const fix of result.fixes) {
    console.log(
      `- ${fix.file}:${fix.line}:${fix.column} ${fix.from} -> ${fix.to}`,
    );
  }
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "help") {
    console.log(usage());
    return;
  }

  if (command === "setup") {
    const result = setupProject(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printSetup(result);
    if (result.errors.length > 0) process.exitCode = 1;
    return;
  }

  if (command === "audit") {
    const result = auditProject(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printAudit(result);
    if (result.errorCount > 0) process.exitCode = 1;
    return;
  }

  if (command === "boundary-check") {
    const result = boundaryCheckProject(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printBoundary(result);
    if (result.errors.length > 0 || result.violations.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "fix-imports") {
    const result = fixImportsProject(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printFixImports(result);
    if (result.errors.length > 0) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
