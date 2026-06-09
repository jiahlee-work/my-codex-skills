import { mkdir } from "node:fs/promises";
import path from "node:path";

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function resolveProjectRoot(
  args = process.argv.slice(2),
  cwd = process.cwd()
): string {
  return path.resolve(
    readOption(args, "--root") ??
      readOption(args, "--repo") ??
      cwd
  );
}

export const projectRoot = resolveProjectRoot();

export function timestampForPath(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function createAgentRunDir(label: string): Promise<string> {
  const runDir = path.join(projectRoot, ".agent-runs", `${label}-${timestampForPath()}`);
  await mkdir(runDir, { recursive: true });
  return runDir;
}

export function relativeToProject(filePath: string): string {
  return path.relative(projectRoot, filePath);
}
