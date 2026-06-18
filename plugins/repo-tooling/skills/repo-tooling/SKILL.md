---
name: repo-tooling
description: "Coordinate standard repository tooling setup. Use when Codex needs to install one or more standard tooling areas: Biome, Vitest with React Testing Library, Storybook, Husky with commitlint, lint-staged, or env files."
---

# Repo Tooling

Use the narrow child skill that matches the requested tooling:

- `biome-setup` for Biome config and lint/format scripts
- `vitest-setup` for Vitest with React Testing Library
- `storybook-setup` for Storybook config
- `husky-commitlint-setup` for Husky and commitlint guardrails
- `lint-staged-setup` for staged Biome checks in pre-commit
- `env-setup` for fixed `.env.example`, `.env.local`, and `.gitignore` env
  patterns

## Boundaries

- Inspect only package manifests, lockfiles, existing tool configs, and existing
  hook files needed for the requested tooling.
- Do not inspect source code to invent custom configs.
- Do not overwrite existing configs or hooks without explicit user approval.
- Env setup may check whether `.env.example` and `.env.local` exist, but must
  not read or copy existing `.env*` values.
- Do not run broad formatting, tests, Storybook builds, or app builds unless the
  user asks.

## Recommended Order

For a fresh repository, prefer:

1. `repo-agent-rules`
2. `biome-setup`
3. `vitest-setup`
4. `storybook-setup`
5. `husky-commitlint-setup`
6. `lint-staged-setup`
7. `env-setup`
