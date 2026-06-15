#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const protectedBranches = (
  process.env.PROTECTED_BRANCHES ?? "main,master,develop"
)
  .split(",")
  .map((branch) => branch.trim())
  .filter(Boolean);

const branch = execFileSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).trim();

if (!branch) {
  process.exit(0);
}

if (protectedBranches.includes(branch)) {
  console.error(
    `Blocked on protected branch "${branch}". Create a feature branch before committing or pushing.`,
  );
  process.exit(1);
}
