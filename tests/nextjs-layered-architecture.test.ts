import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  "plugins/nextjs-app-router/skills/nextjs-layered-architecture/scripts/nextjs-layered-architecture.mjs"
);

const temporaryProjects: string[] = [];

afterEach(() => {
  for (const project of temporaryProjects.splice(0)) {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

function createProject(options: { rootApp?: boolean } = {}) {
  const project = fs.mkdtempSync(
    path.join(os.tmpdir(), "nextjs-layered-architecture-")
  );
  temporaryProjects.push(project);

  fs.writeFileSync(
    path.join(project, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        dependencies: {
          next: "16.0.0",
          react: "19.0.0",
        },
        devDependencies: {
          typescript: "5.9.3",
        },
      },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    `${JSON.stringify({ compilerOptions: { strict: true } }, null, 2)}\n`
  );

  const appRoot = options.rootApp
    ? path.join(project, "app")
    : path.join(project, "src", "app");
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(
    path.join(appRoot, "page.tsx"),
    "export default function Page() { return null; }\n"
  );

  return project;
}

function run(
  command: "setup" | "audit" | "boundary-check" | "fix-imports",
  project: string,
  ...args: string[]
) {
  return spawnSync(
    process.execPath,
    [scriptPath, command, "--project", project, ...args],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
    }
  );
}

describe("nextjs-layered-architecture", () => {
  it("creates the standard structure and configures the root src alias", () => {
    const project = createProject();

    const result = run("setup", project, "--json");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(fs.existsSync(path.join(project, "public", "assets"))).toBe(true);
    expect(fs.existsSync(path.join(project, "src", "types"))).toBe(true);
    expect(fs.existsSync(path.join(project, "src", "presentation", "features"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(project, "src", "application", "hooks"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(project, "src", "infrastructure", "apis"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(project, "src", "shared", "types"))).toBe(true);
    expect(fs.existsSync(path.join(project, "src", "application", "jotai"))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(project, "src", "infrastructure", "firebase"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(project, "src", "infrastructure", "redis"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(project, "src", "infrastructure", "audio"))
    ).toBe(false);

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(project, "tsconfig.json"), "utf8")
    );
    expect(tsconfig.compilerOptions.paths).toEqual({
      "@/*": ["./src/*"],
    });

    const audit = run("audit", project, "--json");
    expect(audit.status).toBe(0);
    expect(JSON.parse(audit.stdout).errorCount).toBe(0);
  });

  it("rejects setup when a root app directory needs an intentional migration", () => {
    const project = createProject({ rootApp: true });

    const result = run("setup", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "root-app",
        }),
      ])
    );
    expect(fs.existsSync(path.join(project, "src", "presentation"))).toBe(false);
  });

  it("reports non-routing source files owned by src/app", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);
    fs.writeFileSync(
      path.join(project, "src", "app", "dashboard-card.tsx"),
      "export function DashboardCard() { return <div />; }\n"
    );

    const result = run("audit", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "app-owned-code",
          file: "src/app/dashboard-card.tsx",
        }),
      ])
    );
  });

  it("reports a missing root src alias", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    const tsconfigPath = path.join(project, "tsconfig.json");
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
    delete tsconfig.compilerOptions.paths["@/*"];
    fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

    const result = run("audit", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "path-alias",
          file: "tsconfig.json",
        }),
      ])
    );
  });

  it("warns about deep relative imports", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    const featureRoot = path.join(
      project,
      "src",
      "presentation",
      "features",
      "subscription"
    );
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(
      path.join(project, "src", "application", "services", "payment.ts"),
      "export const paymentService = {};\n"
    );
    fs.writeFileSync(
      path.join(featureRoot, "index.ts"),
      [
        'import { paymentService } from "../../../application/services/payment";',
        "export const viewModel = paymentService;",
        "",
      ].join("\n")
    );

    const result = run("audit", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "deep-relative-import",
          severity: "warning",
          file: "src/presentation/features/subscription/index.ts:1:32",
        }),
      ])
    );
  });

  it("rewrites deep relative imports to root alias imports", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    const featureRoot = path.join(
      project,
      "src",
      "presentation",
      "features",
      "subscription"
    );
    const featureFile = path.join(featureRoot, "index.ts");
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(
      path.join(project, "src", "application", "services", "payment.ts"),
      "export const paymentService = {};\n"
    );
    fs.writeFileSync(
      featureFile,
      [
        'import { paymentService } from "../../../application/services/payment";',
        "export const viewModel = paymentService;",
        "",
      ].join("\n")
    );

    const dryRun = run("fix-imports", project, "--dry-run", "--json");
    expect(dryRun.status).toBe(0);
    expect(JSON.parse(dryRun.stdout).fixes).toEqual([
      expect.objectContaining({
        file: "src/presentation/features/subscription/index.ts",
        from: "../../../application/services/payment",
        to: "@/application/services/payment",
      }),
    ]);
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      "../../../application/services/payment"
    );

    const result = run("fix-imports", project, "--json");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).changed).toEqual([
      "src/presentation/features/subscription/index.ts",
    ]);
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      'from "@/application/services/payment"'
    );

    const audit = run("audit", project, "--json");
    const auditOutput = JSON.parse(audit.stdout);
    expect(audit.status).toBe(0);
    expect(auditOutput.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "deep-relative-import" }),
      ])
    );
  });

  it("rewrites legacy layer aliases to root alias imports", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    const featureRoot = path.join(
      project,
      "src",
      "presentation",
      "features",
      "subscription"
    );
    const featureFile = path.join(featureRoot, "index.ts");
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(
      featureFile,
      [
        'import { paymentService } from "@application/services/payment";',
        'export { ROUTE_PATHS } from "@shared/constants/route-paths";',
        "export const viewModel = paymentService;",
        "",
      ].join("\n")
    );

    const audit = run("audit", project, "--json");
    const auditOutput = JSON.parse(audit.stdout);
    expect(audit.status).toBe(0);
    expect(auditOutput.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "non-canonical-layer-import",
          severity: "warning",
        }),
      ])
    );

    const result = run("fix-imports", project, "--json");
    const output = JSON.parse(result.stdout);
    expect(result.status).toBe(0);
    expect(output.fixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "@application/services/payment",
          to: "@/application/services/payment",
          code: "non-canonical-layer-import",
        }),
        expect.objectContaining({
          from: "@shared/constants/route-paths",
          to: "@/shared/constants/route-paths",
          code: "non-canonical-layer-import",
        }),
      ])
    );
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      'from "@/application/services/payment"'
    );
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      'from "@/shared/constants/route-paths"'
    );
  });

  it("skips import rewrites when ESLint already owns import path rewriting", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    const featureRoot = path.join(
      project,
      "src",
      "presentation",
      "features",
      "subscription"
    );
    const featureFile = path.join(featureRoot, "index.ts");
    fs.mkdirSync(featureRoot, { recursive: true });
    fs.writeFileSync(
      path.join(project, "src", "application", "services", "payment.ts"),
      "export const paymentService = {};\n"
    );
    fs.writeFileSync(
      featureFile,
      [
        'import { paymentService } from "../../../application/services/payment";',
        "export const viewModel = paymentService;",
        "",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(project, ".eslintrc.json"),
      `${JSON.stringify(
        {
          rules: {
            "no-relative-import-paths/no-relative-import-paths": [
              "error",
              { allowSameFolder: true, rootDir: "src", prefix: "@" },
            ],
          },
        },
        null,
        2
      )}\n`
    );

    const result = run("fix-imports", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.skipped).toBe(true);
    expect(output.fixes).toEqual([]);
    expect(output.warnings).toEqual([
      expect.objectContaining({
        code: "eslint-import-rewrite-config",
        matches: [
          expect.objectContaining({
            file: ".eslintrc.json",
            code: "no-relative-import-paths",
          }),
        ],
      }),
    ]);
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      "../../../application/services/payment"
    );

    const forced = run("fix-imports", project, "--force", "--json");
    expect(forced.status).toBe(0);
    expect(JSON.parse(forced.stdout).skipped).toBe(false);
    expect(fs.readFileSync(featureFile, "utf8")).toContain(
      'from "@/application/services/payment"'
    );
  });

  it("detects imports from infrastructure to application", () => {
    const project = createProject();
    expect(run("setup", project).status).toBe(0);

    fs.writeFileSync(
      path.join(project, "src", "application", "services", "payment.ts"),
      "export const paymentService = {};\n"
    );
    fs.writeFileSync(
      path.join(project, "src", "infrastructure", "apis", "payment.ts"),
      [
        'import { paymentService } from "@/application/services/payment";',
        "export const paymentApi = paymentService;",
        "",
      ].join("\n")
    );

    const result = run("boundary-check", project, "--json");
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(output.violations).toEqual([
      expect.objectContaining({
        importerLayer: "infrastructure",
        importedLayer: "application",
        specifier: "@/application/services/payment",
      }),
    ]);
  });
});
