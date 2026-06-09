import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const protectedBranches = new Set(["main", "master", "develop"]);

export type GitStatusEntry = {
  code: string;
  path: string;
  originalPath?: string;
};

export type GitSafetyResult = {
  repository: string;
  currentBranch: string;
  plannedBranch: string;
  protectedCurrentBranch: boolean;
  dirty: boolean;
  changes: GitStatusEntry[];
  plannedBranchExistsLocal: boolean;
  plannedBranchExistsRemote: boolean;
  safeToCreateBranch: boolean;
  safeToImplement: boolean;
  errors: string[];
  warnings: string[];
};

export type CreateBranchResult = {
  branchName: string;
  created: boolean;
  previousBranch: string;
};

type GitResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runGit(
  repository: string,
  args: string[],
  allowFailure = false
): Promise<GitResult> {
  try {
    const result = await execFileAsync("git", ["-C", repository, ...args], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const failure = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    if (allowFailure) {
      return {
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? failure.message ?? "",
        exitCode: typeof failure.code === "number" ? failure.code : 1
      };
    }
    throw new Error(
      `Git command failed: git ${args.join(" ")}\n${failure.stderr ?? failure.message ?? ""}`.trim()
    );
  }
}

export function parsePorcelainStatus(output: string): GitStatusEntry[] {
  const chunks = output.split("\0");
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk) {
      continue;
    }
    const code = chunk.slice(0, 2);
    const filePath = chunk.slice(3);
    const renamed = code.includes("R") || code.includes("C");
    const originalPath = renamed ? chunks[index + 1] : undefined;
    if (renamed) {
      index += 1;
    }
    entries.push({ code, path: filePath, originalPath });
  }

  return entries;
}

async function branchExists(
  repository: string,
  reference: string
): Promise<boolean> {
  return (await runGit(repository, ["show-ref", "--verify", "--quiet", reference], true))
    .exitCode === 0;
}

export async function inspectGitSafety(options: {
  repository: string;
  plannedBranch: string;
  allowDirty?: boolean;
}): Promise<GitSafetyResult> {
  const repositoryCheck = await runGit(
    options.repository,
    ["rev-parse", "--is-inside-work-tree"],
    true
  );
  if (repositoryCheck.exitCode !== 0 || repositoryCheck.stdout.trim() !== "true") {
    throw new Error(`Not a Git worktree: ${options.repository}`);
  }

  const currentBranch = (
    await runGit(options.repository, ["branch", "--show-current"])
  ).stdout.trim();
  if (!currentBranch) {
    throw new Error("Detached HEAD is not supported during implementation.");
  }

  const status = await runGit(options.repository, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all"
  ]);
  const changes = parsePorcelainStatus(status.stdout).filter(
    (entry) => entry.path !== ".agent-runs" && !entry.path.startsWith(".agent-runs/")
  );
  const plannedBranchExistsLocal = await branchExists(
    options.repository,
    `refs/heads/${options.plannedBranch}`
  );
  const remoteBranches = (
    await runGit(
      options.repository,
      ["for-each-ref", "--format=%(refname:short)", "refs/remotes"],
      true
    )
  ).stdout
    .split(/\r?\n/)
    .filter(Boolean);
  const plannedBranchExistsRemote = remoteBranches.some((branch) =>
    branch.endsWith(`/${options.plannedBranch}`)
  );
  const protectedCurrentBranch = protectedBranches.has(currentBranch);
  const dirty = changes.length > 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dirty && !options.allowDirty) {
    errors.push("The worktree has uncommitted changes and no explicit approval was recorded.");
  } else if (dirty) {
    warnings.push("Continuing with pre-existing changes because --allow-dirty was supplied.");
  }

  if (
    currentBranch !== options.plannedBranch &&
    (plannedBranchExistsLocal || plannedBranchExistsRemote)
  ) {
    errors.push(
      `Planned branch already exists. Do not overwrite it; consider ${options.plannedBranch}-2 after updating the branch plan.`
    );
  }

  if (protectedCurrentBranch) {
    warnings.push(
      `Protected base branch ${currentBranch} is checked out. Create the planned branch before editing.`
    );
  }

  const safeToCreateBranch = errors.length === 0;
  const safeToImplement =
    errors.length === 0 &&
    currentBranch === options.plannedBranch &&
    !protectedCurrentBranch;

  return {
    repository: options.repository,
    currentBranch,
    plannedBranch: options.plannedBranch,
    protectedCurrentBranch,
    dirty,
    changes,
    plannedBranchExistsLocal,
    plannedBranchExistsRemote,
    safeToCreateBranch,
    safeToImplement,
    errors,
    warnings
  };
}

export async function createWorkingBranch(options: {
  repository: string;
  plannedBranch: string;
  allowDirty?: boolean;
}): Promise<CreateBranchResult> {
  const safety = await inspectGitSafety(options);
  if (!safety.safeToCreateBranch) {
    throw new Error(safety.errors.join("\n"));
  }
  if (safety.currentBranch === options.plannedBranch) {
    if (safety.protectedCurrentBranch) {
      throw new Error("Refusing to implement on a protected branch.");
    }
    return {
      branchName: options.plannedBranch,
      created: false,
      previousBranch: safety.currentBranch
    };
  }

  await runGit(options.repository, ["switch", "-c", options.plannedBranch]);
  return {
    branchName: options.plannedBranch,
    created: true,
    previousBranch: safety.currentBranch
  };
}

export function isProtectedBranch(branchName: string): boolean {
  return protectedBranches.has(branchName);
}
