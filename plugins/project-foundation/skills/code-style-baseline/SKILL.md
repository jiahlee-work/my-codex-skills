---
name: code-style-baseline
description: Install or update repo-local React, Next.js, TypeScript, Biome, and VS Code code style baselines. Use when Codex needs to add AGENTS coding-style instructions, docs/engineering/coding-style.md, biome.json, .vscode/settings.json, or apply shared UI coding rules to a repository.
---

# Code Style Baseline

## Procedure

1. Inspect existing `AGENTS.md`, engineering docs, formatter, linter, and editor
   settings.
2. Apply the baseline only to repositories that use React, Next.js, TypeScript,
   JavaScript, or CSS. For non-frontend repositories, add only generic AGENTS
   guidance when requested.
3. Keep the target repo as the source of truth:
   - Write `docs/engineering/coding-style.md` from
     `references/coding-style-guide.md`.
   - Merge the snippet from `references/agents-coding-style-snippet.md` into
     `AGENTS.md`.
   - Write or merge `biome.json` from `assets/biome.json`.
   - Write or merge `.vscode/settings.json` from `assets/vscode-settings.json`.
4. Preserve stricter project-specific rules and explicit user instructions.
5. Do not broad-reformat existing files as part of setup. Formatting existing
   code is a separate approved change.
6. Add package scripts only with approval:
   - `lint`: `biome check .`
   - `lint:fix`: `biome check --write .`
   - `format`: `biome format --write .`

## Style Boundary

- Let Codex enforce the contextual rules in `coding-style-guide.md` while editing
  code: component declaration order, props destructuring, boolean naming,
  handler naming, derived state, effects, early returns, class composition,
  component splitting, exports, condition naming, and comments.
- Let Biome enforce automatable rules: import ordering, formatting, nested
  ternary rejection, block statements, unsafe HTML, debugger use, and selected
  suspicious patterns.

## Assets

- `assets/biome.json`
- `assets/vscode-settings.json`

## References

- `references/coding-style-guide.md`
- `references/agents-coding-style-snippet.md`
