---
name: project-health-check
description: Resolve and run repository health checks after setup or implementation changes. Use when Codex needs to detect package manager scripts and run or plan lint, typecheck, test, build, Storybook build, or CI-equivalent local verification without modifying source files.
---

# Project Health Check

## Procedure

1. Inspect package manager and package scripts.
2. Resolve available checks in this order:
   - lint
   - typecheck
   - test
   - build
   - build-storybook when Storybook changed or was added
3. Skip missing commands rather than failing the repository.
4. Do not modify source, tests, package files, lockfiles, or configuration during
   health checks.
5. Stop after the first failure unless the user asks to continue.
6. Analyze failures and report the command, exit code, likely cause, and next
   fix. Do not auto-fix unless the user asks for a follow-up implementation pass.

## Modes

- Light: lint, typecheck, and test.
- Full: lint, typecheck, test, build, and Storybook build when configured.

Recommend full mode for package, lockfile, config, Storybook, test setup,
GitHub Actions, auth, routing, build, or framework changes.

## Resource

- `references/health-check-report-template.md`
