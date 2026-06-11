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
  command: "setup" | "audit" | "boundary-check",
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
  it("creates the standard layers and configures the src alias", () => {
    const project = createProject();

    const result = run("setup", project, "--json");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
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

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(project, "tsconfig.json"), "utf8")
    );
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);

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
