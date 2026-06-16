---
name: biome-setup
description: Install or update standard Biome tooling. Use when Codex needs to add @biomejs/biome, write biome.json from the bundled standard config, and add lint, lint:fix, and format package scripts without formatting the repository.
---

# Biome Setup

## Workflow

1. Confirm `package.json` exists. If it does not, stop and report that Biome
   setup requires a Node package manifest.
2. Infer package manager:
   - `packageManager` field in `package.json`
   - lockfile: `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`, `yarn.lock`,
     `package-lock.json`
   - fallback to `npm`
3. Install `@biomejs/biome` with the inferred package manager.
4. Write `biome.json` from `assets/biome.json`.
   - If `biome.json` already exists, ask before overwriting it.
5. Add or update package scripts:
   - `lint`: `biome check .`
   - `lint:fix`: `biome check --write .`
   - `format`: `biome format --write .`
6. Do not run broad formatting automatically.

## Install Commands

- pnpm: `pnpm add -D @biomejs/biome`
- npm: `npm install --save-dev @biomejs/biome`
- yarn: `yarn add -D @biomejs/biome`
- bun: `bun add -d @biomejs/biome`

## Completion

Report files changed, dependencies installed, scripts added or preserved, and
whether `biome.json` was written or left unchanged.
