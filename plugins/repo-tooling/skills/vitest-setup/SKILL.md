---
name: vitest-setup
description: Install Vitest with React Testing Library for Next.js or React/TypeScript projects. Use when Codex needs to add Vitest, jsdom, testing-library packages, vitest.config.ts, src/test/setup-tests.ts, src/test/test-utils.tsx, and test scripts.
---

# Vitest Setup

## Required User Choice

Before writing files, ask for project type unless the request already answers it:

- `Next.js`
- `React/TypeScript`

## Workflow

1. Confirm `package.json` exists.
2. Infer package manager from `packageManager`, lockfile, then fallback to `npm`.
3. Install common dependencies:
   - `vitest`
   - `jsdom`
   - `@testing-library/react`
   - `@testing-library/jest-dom`
   - `@testing-library/user-event`
4. For `React/TypeScript`, also install `@vitejs/plugin-react`.
5. Write:
   - `vitest.config.ts`
   - `src/test/setup-tests.ts`
   - `src/test/test-utils.tsx`
6. If any target file exists, ask before overwriting it.
7. Add package scripts:
   - `test`: `vitest run`
   - `test:watch`: `vitest`
   - `test:coverage`: `vitest run --coverage`
8. Do not create product tests automatically.

## Placement Rule

When later adding tests, follow `docs/engineering/testing.md` when it exists:
tests live near the code they cover in `__tests__/*.test.ts(x)`.

## Assets

- `assets/vitest.config.next.ts.template`
- `assets/vitest.config.react.ts.template`
- `assets/setup-tests.ts.template`
- `assets/test-utils.tsx.template`
