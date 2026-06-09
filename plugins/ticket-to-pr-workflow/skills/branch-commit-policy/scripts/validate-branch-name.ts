import { validateBranchName } from "./branch-commit-policy.js";

function main(): void {
  const branchName = process.argv[2];
  const ticketKey = process.argv[3];

  if (!branchName || !ticketKey) {
    console.error("Usage: validate-branch-name.ts <branchName> <ticketKey>");
    process.exitCode = 1;
    return;
  }

  const result = validateBranchName(branchName, ticketKey);

  if (!result.valid) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
