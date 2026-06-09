# Verification Policy

Local Verification validates the Implementation working tree without modifying it.

## Modes

- Light: run available lint, typecheck, and test commands.
- Full: run available lint, typecheck, test, and build commands.

Recommend full mode for UI flows, API integration, authentication,
authorization, payment, security, state management, package or lockfile
changes, test environment changes, more than 200 diff lines, more than eight
changed files, or any risk report finding.

An explicit user mode wins. Record a warning when light mode overrides a full
recommendation.

## Command Handling

Run lint, typecheck, test, then build. A missing command is skipped, not failed.
Stop after a failure unless `--continue-on-failure` is set. Save stdout, stderr,
exit code, duration, and status under the selected agent run.

Playwright and E2E commands may be detected in full mode, but Local verification must not
execute them.
