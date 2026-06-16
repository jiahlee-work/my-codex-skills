---
name: repo-agent-rules
description: Install fixed repo-local AGENTS.md and fixed engineering rule docs. Use when Codex needs to create or refresh common agent rules across repositories without repository-specific documentation or tooling setup.
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

Do not inspect package manager, package dependencies, lockfiles, tool configs, or
hooks. This skill installs fixed rule documents only.

## Fixed Output Contract

Always write these files from assets:

- `AGENTS.md`
- `docs/engineering/coding-style.md`
- `docs/engineering/architecture.md`
- `docs/engineering/testing.md`
- `docs/engineering/storybook.md`
- `docs/engineering/verification.md`
- `docs/engineering/git-workflow.md`

Do not create or update any other file, including `README.md`, `docs/*.md`
outside `docs/engineering`, API docs, prompt docs, development docs, package
scripts, CI files, test config, Storybook config, formatter config, hooks,
commitlint config, or editor config.

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
- `assets/docs/storybook.md`
- `assets/docs/verification.md`
- `assets/docs/git-workflow-main-forbidden.md` or
  `assets/docs/git-workflow-main-allowed.md`

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
- that no package, hook, or tooling setup was performed

Do not run application lint, test, typecheck, build, Storybook, browser, or API
verification unless the user explicitly asks.
