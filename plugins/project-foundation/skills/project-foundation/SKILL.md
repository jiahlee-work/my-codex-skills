---
name: project-foundation
description: Audit a repository and plan or apply repeatable project foundation setup. Use when Codex needs to install, update, or check repo-local AGENTS instructions, engineering docs, Next.js layered architecture docs, Biome and VS Code settings, Husky and commitlint guardrails, optional branch guard scripts, GitHub Actions CI, Vitest with React Testing Library, Storybook, or local verification commands across multiple repositories.
---

# Project Foundation

## Purpose

Use this parent skill to make repository foundations explicit and repo-local.
The plugin provides reusable defaults, but the target repository should own the
resulting rules and files: `AGENTS.md`, engineering docs, tool configs, hooks,
workflows, and test or Storybook setup.

## Workflow

1. Inspect the target repository before proposing changes:
   - package manager and lockfile
   - framework and language stack
   - existing `AGENTS.md`, docs, formatter, linter, test, Storybook, hook, CI,
     and GitHub remote configuration
   - current branch and dirty working tree
   Use inspection only to classify baseline applicability, detect conflicts, and
   choose approved setup steps. Do not turn observed repository state into
   descriptive `AGENTS.md` content.
2. Produce an audit with four states for each baseline area:
   - `present`: compatible setup exists
   - `missing`: setup is absent
   - `drifted`: setup exists but differs from the baseline
   - `not-applicable`: stack does not match the baseline
3. Ask for approval before editing files, installing dependencies, changing
   lockfiles, creating hooks, running setup commands, or mutating GitHub branch
   protection.
4. Apply only approved baseline areas and preserve target repo conventions that
   are more specific than this plugin when they are written as prescriptive
   rules. Do not preserve or generate descriptive summaries of current structure
   as durable agent instructions.
5. Store durable rules in the target repo. Do not require this plugin to be
   present for future contributors, CI, or other coding agents to understand
   the rules.
6. Run `project-health-check` after setup unless the user asks for audit-only.

## Baseline Areas

- Merge `references/agents-foundation-snippet.md` into `AGENTS.md` before other
  baseline snippets when creating or refreshing repository instructions.
- Use `code-style-baseline` for `AGENTS.md`, engineering style docs,
  `biome.json`, and `.vscode/settings.json`.
- Use `nextjs-architecture-baseline` for Next.js App Router architecture docs
  and `AGENTS.md` architecture instructions.
- Use `repo-guardrails` for `AGENTS.md` Git workflow instructions,
  `docs/engineering/git-workflow.md`, Husky, commitlint, optional branch guard
  scripts, GitHub Actions CI, and optional GitHub branch protection guidance.
- Use `react-test-setup` for `AGENTS.md` testing instructions,
  `docs/engineering/testing.md`, and Vitest with React Testing Library.
- Use `storybook-setup` for `AGENTS.md` Storybook instructions,
  `docs/engineering/storybook.md`, setup, and story conventions.
- Use `project-health-check` to resolve and run lint, typecheck, test, and build
  commands, and to provide the `AGENTS.md` verification instructions used by the
  foundation baseline.
- For architecture audits, migrations, or import-boundary checks, prefer the
  separate `nextjs-layered-architecture` skill when available.

Keep long-lived, always-on agent behavior in target-repository `AGENTS.md`
snippets and engineering docs. Keep executable helpers, setup automation,
validation scripts, and multi-step workflows in this plugin.

Follow `references/agents-composition-policy.md` whenever creating or updating
target-repository `AGENTS.md`.

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
- AGENTS composition policy: `references/agents-composition-policy.md`
- Foundation AGENTS snippet: `references/agents-foundation-snippet.md`
