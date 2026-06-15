# Repo Guardrails Checklist

- [ ] `husky` installed as a dev dependency
- [ ] `prepare` script runs `husky`
- [ ] `@commitlint/cli` and `@commitlint/config-conventional` installed
- [ ] `commitlint.config.cjs` enforces `{type}: {Korean summary}`
- [ ] `.husky/commit-msg` runs commitlint
- [ ] branch guard profile is recorded in `AGENTS.md` and
      `docs/engineering/git-workflow.md`
- [ ] `.husky/pre-commit` blocks protected branches and runs Biome when present
      if `local-hooks` is selected
- [ ] `.husky/pre-push` blocks protected branches if `local-hooks` is selected
- [ ] `scripts/guard-branch.mjs` exists if `local-hooks` is selected
- [ ] `.github/workflows/ci.yml` runs install, lint, typecheck, test, and build
- [ ] GitHub branch protection is documented or configured if
      `remote-protection` is selected
