---
name: repo-agent-rules
description: Install fixed repo-local AGENTS.md, fixed engineering rule docs, and minimal Husky/commitlint guardrails. Use when Codex needs to create or refresh common agent rules across repositories without repository-specific documentation.
---

# Repo Agent Rules

## Purpose

Install the same common agent rules across repositories. This skill writes fixed
files from this plugin's assets. It must not inspect repository source to
generate custom documentation.

## Required User Choices

Before writing files, ask the user for exactly these two choices unless the
current request already answers them:

1. Project type:
   - `Next.js`
   - `React/TypeScript`
2. Main push policy:
   - `main push forbidden`
   - `main push allowed`

Do not ask for commit message language, package manager, test runner, framework
details, API details, docs scope, or repository structure.

## No Repository Documentation From Inspection

Do not inspect source files, route files, API files, README, existing docs,
environment files, UI implementation, package scripts, or current feature
behavior to generate documentation.

The only allowed repository state checks are the minimum checks needed to make
Husky and commitlint work:

- `package.json`
- package manager from `packageManager` or lockfile
- existing `devDependencies.husky`
- existing `devDependencies.@commitlint/cli`
- existing `devDependencies.@commitlint/config-conventional`
- existing `scripts.prepare`
- `.husky/`

Use these checks only for hook setup. Do not include their results in generated
docs.

## Fixed Output Contract

Always write these files from assets:

- `AGENTS.md`
- `docs/engineering/coding-style.md`
- `docs/engineering/architecture.md`
- `docs/engineering/testing.md`
- `docs/engineering/verification.md`
- `docs/engineering/git-workflow.md`
- `commitlint.config.cjs`
- `.husky/commit-msg`
- `.husky/pre-commit`

When main push is forbidden, also write:

- `.husky/pre-push`
- `scripts/guard-branch.mjs`

When main push is allowed, do not write `.husky/pre-push` or
`scripts/guard-branch.mjs` unless the user explicitly asks for those paths.

Do not create or update any other file, including `README.md`, `docs/*.md`
outside `docs/engineering`, API docs, prompt docs, development docs, package
scripts beyond `prepare`, CI files, test config, Storybook config, formatter
config, or editor config.

## Asset Selection

Use these fixed assets:

- `assets/agents/nextjs-main-forbidden.md` for Next.js and main push forbidden
- `assets/agents/nextjs-main-allowed.md` for Next.js and main push allowed
- `assets/agents/react-typescript-main-forbidden.md` for React/TypeScript and
  main push forbidden
- `assets/agents/react-typescript-main-allowed.md` for React/TypeScript and main
  push allowed
- `assets/docs/coding-style.md`
- `assets/docs/architecture-nextjs.md` or
  `assets/docs/architecture-react-typescript.md`
- `assets/docs/testing.md`
- `assets/docs/verification.md`
- `assets/docs/git-workflow-main-forbidden.md` or
  `assets/docs/git-workflow-main-allowed.md`
- `assets/hooks/commitlint.config.cjs`
- `assets/hooks/commit-msg`
- `assets/hooks/pre-commit`
- `assets/hooks/pre-push-main-forbidden` when main push is forbidden
- `assets/hooks/guard-branch.mjs` when main push is forbidden

## Hook Setup

If `package.json` exists, install missing hook dependencies without asking:

- `husky`
- `@commitlint/cli`
- `@commitlint/config-conventional`

Infer the package manager in this order:

1. `packageManager` field in `package.json`
2. lockfile: `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`, `yarn.lock`,
   `package-lock.json`
3. fallback to `npm`

Use the matching install command:

- pnpm: `pnpm add -D husky @commitlint/cli @commitlint/config-conventional`
- npm: `npm install --save-dev husky @commitlint/cli @commitlint/config-conventional`
- yarn: `yarn add -D husky @commitlint/cli @commitlint/config-conventional`
- bun: `bun add -d husky @commitlint/cli @commitlint/config-conventional`

Ensure `package.json` has `"prepare": "husky"` while preserving existing
scripts. If `prepare` already exists and is not `husky`, do not overwrite it;
report that hook installation may need manual integration.

Make generated Husky files executable.

If `package.json` does not exist, still write the fixed docs and report that
Husky/commitlint setup was skipped because there is no Node package manifest.

## Commit Message Policy

Commit messages use Conventional Commits with optional scope:

```text
<type>[optional scope]: <description>
```

English and Korean descriptions are both allowed.

## Completion

After installing rules, report:

- the two selected choices
- files written
- hook dependencies installed or already present
- any hook setup skipped because `package.json` was missing

Do not run application lint, test, typecheck, build, Storybook, browser, or API
verification unless the user explicitly asks.
