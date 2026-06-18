# Repo Tooling

Installs standard development tooling for React, TypeScript, and Next.js
repositories.

## Skills

- `biome-setup`: install Biome, write `biome.json`, and add lint/format scripts.
- `vitest-setup`: install Vitest with React Testing Library and write test setup
  files.
- `storybook-setup`: install Storybook for Next.js Vite or React Vite and write
  Storybook config.
- `husky-commitlint-setup`: install Husky and commitlint guardrails.
- `lint-staged-setup`: install lint-staged and merge it into the pre-commit
  hook without removing existing guards.
- `env-setup`: create fixed `.env.example`, fixed `.env.local`, and merge env
  ignore patterns into `.gitignore`.

## Boundaries

- Tooling setup may inspect `package.json`, lockfiles, existing config files,
  and existing hooks.
- Tooling setup must not inspect source code to generate custom rules.
- Env setup may check whether `.env.example` and `.env.local` exist, but must
  not read or copy existing `.env*` values.
- Existing config files are not overwritten without explicit user approval.
- Broad formatting, test runs, Storybook builds, and app builds are not run
  unless the user asks.
