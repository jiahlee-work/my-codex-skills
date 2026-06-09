import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeTextFile(
  directory: string,
  fileName: string,
  content: string
): Promise<void> {
  await writeFile(path.join(directory, fileName), content, "utf8");
}

export async function writeJsonFile(
  directory: string,
  fileName: string,
  value: unknown
): Promise<void> {
  await writeTextFile(directory, fileName, JSON.stringify(value, null, 2));
}
