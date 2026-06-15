---
name: react-test-setup
description: Install or update Vitest and React Testing Library setup for React, Next.js, and TypeScript repositories. Use when Codex needs to detect test stack gaps, add vitest.config.ts, test setup utilities, jsdom, @testing-library/react, @testing-library/jest-dom, and package scripts for unit or component tests.
---

# React Test Setup

## Procedure

1. Inspect `package.json`, lockfile, existing test config, test files, and app
   framework.
2. If another complete test stack exists, report it and ask before replacing or
   layering Vitest on top.
3. For React or Next.js TypeScript projects, propose Vitest + React Testing
   Library with jsdom.
4. Require approval before installing dependencies or editing package, lock,
   config, setup, or test utility files.
5. Copy or adapt:
   - `assets/vitest.config.ts.template`
   - `assets/setup-tests.ts.template`
   - `assets/test-utils.tsx.template`
6. Add package scripts when approved:
   - `test`: `vitest run`
   - `test:watch`: `vitest`
   - `test:coverage`: `vitest run --coverage`
7. Add dev dependencies when approved:
   - `vitest`
   - `jsdom`
   - `@testing-library/react`
   - `@testing-library/jest-dom`
   - `@testing-library/user-event`
   - `@vitejs/plugin-react` for non-Next Vite/React projects when needed

## Conventions

- Put setup in `src/test/setup-tests.ts`.
- Put shared render helpers in `src/test/test-utils.tsx`.
- Prefer user-visible queries over implementation details.
- Keep tests focused on behavior and accessibility.
- Use existing mocks and providers when present.

## Resource

- `references/testing-policy.md`
