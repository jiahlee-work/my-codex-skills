# Repo Guardrails Checklist

- [ ] `husky` installed as a dev dependency
- [ ] `prepare` script runs `husky`
- [ ] `@commitlint/cli` and `@commitlint/config-conventional` installed
- [ ] `commitlint.config.cjs` enforces `{type}: {Korean summary}`
- [ ] `.husky/commit-msg` runs commitlint
- [ ] `.husky/pre-commit` blocks protected branches and runs Biome when present
- [ ] `.husky/pre-push` blocks protected branches
- [ ] `scripts/guard-branch.mjs` exists
- [ ] `.github/workflows/ci.yml` runs install, lint, typecheck, test, and build
- [ ] GitHub branch protection blocks direct updates to `main`
