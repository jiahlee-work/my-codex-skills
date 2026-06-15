---
name: branch-commit-policy
description: Choose branch and commit types from ticket content and expected code changes, generate a Branch and Commit Plan, and validate branch names or scope-free commit messages. Use for ticket-linked branch and commit policy work.
---

# Branch Commit Policy

## When To Use

Use when planning or validating ticket-linked branches and commits.

## Inputs

- Ticket content and expected change characteristics
- Ticket key
- Proposed branch name or commit message

## Outputs

- Branch type and branch name
- Scope-free commit message with a lowercase type and Korean summary
- Validation results
- `branch-commit-plan.md`

## Main Steps

1. Infer change type from content, not Jira work type.
2. Generate `{type}/{ticketKey}-{slug}`.
3. Generate `{type}: {Korean summary}` with `Refs: {ticketKey}`.
4. Validate both proposals.

## Related Resources And Scripts

- `resources/branch-policy.md`
- `resources/commit-policy.md`
- `resources/branch-commit-plan-template.md`
- `scripts/validate-branch-name.ts`
- `scripts/validate-commit-message.ts`
