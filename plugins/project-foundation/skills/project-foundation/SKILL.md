---
name: project-foundation
description: Audit a repository and plan or apply repeatable project foundation setup. Use when Codex needs to install, update, or check repo-local AGENTS instructions, engineering docs, Next.js layered architecture docs, Biome and VS Code settings, Husky and commitlint guardrails, branch guard scripts, GitHub Actions CI, Vitest with React Testing Library, Storybook, or local verification commands across multiple repositories.
---

# Project Foundation

## Purpose

Use this parent skill to make repository foundations explicit and repo-local.
The plugin provides reusable defaults, but the target repository should own the
resulting files: `AGENTS.md`, engineering docs, tool configs, hooks, workflows,
and test or Storybook setup.

## Workflow

1. Inspect the target repository before proposing changes:
   - package manager and lockfile
   - framework and language stack
   - existing `AGENTS.md`, docs, formatter, linter, test, Storybook, hook, CI,
     and GitHub remote configuration
   - current branch and dirty working tree
2. Produce an audit with four states for each baseline area:
   - `present`: compatible setup exists
   - `missing`: setup is absent
   - `drifted`: setup exists but differs from the baseline
   - `not-applicable`: stack does not match the baseline
3. Ask for approval before editing files, installing dependencies, changing
   lockfiles, creating hooks, running setup commands, or mutating GitHub branch
   protection.
4. Apply only approved baseline areas and preserve target repo conventions that
   are more specific than this plugin.
5. Store durable rules in the target repo. Do not require this plugin to be
   present for future contributors or CI to understand the rules.
6. Run `project-health-check` after setup unless the user asks for audit-only.

## Baseline Areas

- Use `code-style-baseline` for `AGENTS.md`, engineering style docs,
  `biome.json`, and `.vscode/settings.json`.
- Use `nextjs-architecture-baseline` for Next.js App Router architecture docs
  and `AGENTS.md` architecture instructions.
- Use `repo-guardrails` for Husky, commitlint, custom branch guard scripts,
  GitHub Actions CI, and GitHub branch protection guidance.
- Use `react-test-setup` for Vitest and React Testing Library.
- Use `storybook-setup` for Storybook setup and story conventions.
- Use `project-health-check` to resolve and run lint, typecheck, test, and build
  commands.
- For architecture audits, migrations, or import-boundary checks, prefer the
  separate `nextjs-layered-architecture` skill when available.

## Approval Rules

- Safe without approval: read files, inspect package scripts, check config
  presence, and draft a plan.
- Approval required: edit repository files, install dependencies, run package
  manager commands that update lockfiles, initialize Storybook, add Husky hooks,
  create GitHub Actions workflows, or change GitHub branch protection.
- Never commit, push, or create a PR from this skill unless the user explicitly
  asks for delivery after reviewing the diff.

## Resource

- Audit template: `references/foundation-audit-template.md`
