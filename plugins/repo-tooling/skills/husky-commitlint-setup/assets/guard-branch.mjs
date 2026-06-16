#!/usr/bin/env node

import { execSync } from "node:child_process";

const protectedBranches = new Set(["main", "master"]);
const branch = execSync("git branch --show-current", {
  encoding: "utf8",
}).trim();

if (protectedBranches.has(branch)) {
  console.error(`Direct push from protected branch "${branch}" is forbidden.`);
  console.error("Create a feature branch before pushing.");
  process.exit(1);
}
