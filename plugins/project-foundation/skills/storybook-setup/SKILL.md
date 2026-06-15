---
name: storybook-setup
description: Install or update repo-local AGENTS Storybook instructions, Storybook policy docs, setup, and story-writing conventions for React, Next.js, and TypeScript UI repositories. Use when Codex needs to detect Storybook, propose setup, add docs/engineering/storybook.md, add .storybook configuration, create story scripts, or establish component story conventions.
---

# Storybook Setup

## Procedure

1. Detect framework, package manager, TypeScript, existing Storybook files,
   package scripts, and story file patterns.
2. Merge `references/agents-storybook-snippet.md` into `AGENTS.md` and write or
   merge `docs/engineering/storybook.md` from `references/storybook-policy.md`
   when the user approves repo-local Storybook documentation.
3. Prefer the official Storybook initializer for missing setup:
   - `pnpm dlx storybook@latest init`
   - `npm create storybook@latest`
   - `yarn create storybook`
4. Require approval before running initializer commands, installing
   dependencies, or editing `.storybook`, package, lock, or story files.
5. If setup exists, preserve framework adapter and only add missing scripts or
   conventions.
6. Add package scripts when approved:
   - `storybook`: `storybook dev -p 6006`
   - `build-storybook`: `storybook build`
7. Copy or adapt assets only when manual setup is requested:
   - `assets/main.ts.template`
   - `assets/preview.ts.template`

## Story Conventions

- Write stories for reusable UI components, important states, empty/error/loading
  states, and components touched by feature work.
- Keep stories close to the component unless the target repo has a central story
  convention.
- Prefer typed `Meta` and `StoryObj`.
- Use realistic props and accessible labels.
- Do not create stories for page-level components that require production-only
  services unless mocks are available.

## Resource

- `references/storybook-policy.md`
- `references/agents-storybook-snippet.md`
