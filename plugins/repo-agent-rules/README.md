# Repo Agent Rules

Installs fixed repo-local instructions for coding agents.

This plugin does not audit or describe the target repository. It asks the user
only for:

1. Project type: `Next.js` or `React/TypeScript`
2. Main push policy: `main push forbidden` or `main push allowed`

Then it writes the matching fixed `AGENTS.md` and fixed engineering docs.

## Generated Files

Always generated:

- `AGENTS.md`
- `docs/engineering/coding-style.md`
- `docs/engineering/architecture.md`
- `docs/engineering/testing.md`
- `docs/engineering/storybook.md`
- `docs/engineering/verification.md`
- `docs/engineering/git-workflow.md`

## Boundaries

- Do not inspect source code, routes, APIs, environment variables, or package
  scripts to generate docs.
- Do not create README links or repository-specific docs.
- Do not install packages, edit `package.json`, create hooks, or write tooling
  configs. Use `repo-tooling` for executable tooling setup.
