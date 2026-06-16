---
name: husky-commitlint-setup
description: Install Husky and commitlint guardrails. Use when Codex needs to add husky, @commitlint/cli, @commitlint/config-conventional, commitlint.config.cjs, commit-msg and pre-commit hooks, and optional protected-branch pre-push hook.
---

# Husky Commitlint Setup

## Required User Choice

Before writing branch guard files, ask for main push policy unless the request
already answers it:

- `main push forbidden`
- `main push allowed`

## Workflow

1. Confirm `package.json` exists.
2. Infer package manager from `packageManager`, lockfile, then fallback to `npm`.
3. Install:
   - `husky`
   - `@commitlint/cli`
   - `@commitlint/config-conventional`
4. Write `commitlint.config.cjs` from `assets/commitlint.config.cjs`.
   Ask before overwriting an existing config.
5. Ensure package script `"prepare": "husky"` exists. If another `prepare`
   script exists, do not overwrite it; report that manual merge is needed.
6. Write or merge Husky hooks:
   - `.husky/commit-msg` runs commitlint.
   - `.husky/pre-commit` keeps any existing content and includes the secret file
     guard block from `assets/pre-commit-secret-guard.sh`.
7. For `main push forbidden`, also write:
   - `.husky/pre-push`
   - `scripts/guard-branch.mjs`
8. Make generated hook files executable.

## Commit Policy

Use Conventional Commits with optional scope:

```text
<type>[optional scope]: <description>
```

English and Korean descriptions are both allowed.
