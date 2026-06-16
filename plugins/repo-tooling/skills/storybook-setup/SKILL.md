---
name: storybook-setup
description: Install standard Storybook setup for Next.js or React/TypeScript projects. Use when Codex needs to add Storybook packages, .storybook/main.ts, .storybook/preview.ts, and storybook scripts without generating component stories.
---

# Storybook Setup

## Required User Choice

Before writing files, ask for project type unless the request already answers it:

- `Next.js`
- `React/TypeScript`

## Workflow

1. Confirm `package.json` exists.
2. Infer package manager from `packageManager`, lockfile, then fallback to `npm`.
3. Install dependencies:
   - Next.js: `storybook`, `@storybook/nextjs-vite`, `@storybook/addon-docs`,
     `vite`
   - React/TypeScript: `storybook`, `@storybook/react-vite`,
     `@storybook/addon-docs`, `vite`
4. Write:
   - `.storybook/main.ts`
   - `.storybook/preview.ts`
5. If `.storybook/main.ts` or `.storybook/preview.ts` exists, ask before
   overwriting it.
6. Add package scripts:
   - `storybook`: `storybook dev -p 6006`
   - `build-storybook`: `storybook build`
7. Do not create example stories automatically.

## Placement Rule

When later adding stories, follow `docs/engineering/storybook.md` when it
exists: stories live next to the component as `*.stories.tsx`.

## Assets

- `assets/main.next.ts.template`
- `assets/main.react.ts.template`
- `assets/preview.ts.template`
