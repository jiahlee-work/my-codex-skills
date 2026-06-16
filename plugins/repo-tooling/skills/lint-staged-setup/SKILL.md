---
name: lint-staged-setup
description: Install lint-staged and connect it to Husky pre-commit while preserving existing hook guards. Use when Codex needs staged-file Biome checks and a package.json lint-staged config.
---

# Lint-Staged Setup

## Workflow

1. Confirm `package.json` exists.
2. Infer package manager from `packageManager`, lockfile, then fallback to `npm`.
3. Install `lint-staged`.
4. If `@biomejs/biome` is missing, install it because the standard lint-staged
   command uses Biome.
5. Add package config:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,jsonc,css,md,mdx}": "biome check --write"
  }
}
```

If an existing `lint-staged` config exists, ask before replacing it.
6. Merge lint-staged execution into `.husky/pre-commit` without removing
   existing content. Use the managed block from `assets/pre-commit-lint-staged.sh`.
7. If `.husky/pre-commit` does not exist, create it.
8. Make `.husky/pre-commit` executable.

## Boundary

Do not run lint-staged automatically unless the user asks.
