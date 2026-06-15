# Project Foundation

Reusable Codex skills for applying repo-local project foundations across
repositories.

The plugin provides defaults for repo-local foundations:

- AGENTS instructions and engineering docs
- Next.js App Router layered architecture docs
- Biome and VS Code settings
- Husky, commitlint, optional branch guards, GitHub Actions CI, and optional
  branch protection
- Vitest with React Testing Library
- Storybook
- local lint, typecheck, test, and build health checks

The target repository remains the source of truth after setup. Durable rules
should live in that repository's `AGENTS.md` and `docs/engineering/*` so any
coding agent can follow them without requiring this plugin. Generated docs,
configs, hooks, and workflows should be committed to that repository.
