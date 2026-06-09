import { validateCommitMessage } from "./branch-commit-policy.js";

function main(): void {
  const message = process.argv[2];
  const ticketKey = process.argv[3];

  if (!message || !ticketKey) {
    console.error("Usage: validate-commit-message.ts <message> <ticketKey>");
    process.exitCode = 1;
    return;
  }

  const result = validateCommitMessage(message, ticketKey);

  if (!result.valid) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
