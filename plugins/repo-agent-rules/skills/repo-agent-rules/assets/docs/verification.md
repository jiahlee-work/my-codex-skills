# Verification

Verification should match the risk and scope of the change.

## Rules

- Run the narrowest relevant check first.
- Prefer existing repository scripts and conventions.
- Do not add scripts, tools, or dependencies only to satisfy verification unless
  the user asks.
- For behavior changes, run relevant tests when they exist.
- For TypeScript changes, run type checking when available.
- For UI or integration-sensitive changes, run a build or browser verification
  when the repository supports it and the risk justifies it.
- If a check fails, stop and report the command, failure, and likely next fix.
- If a check cannot be run, report why and describe the remaining risk.

## Reporting

When finishing work, report:

- files changed
- checks run
- checks not run and why
- any remaining risk or follow-up needed
