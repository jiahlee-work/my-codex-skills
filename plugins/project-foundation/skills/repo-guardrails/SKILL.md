---
name: repo-guardrails
description: Install or update repository guardrails for repo-local AGENTS Git workflow instructions, Git hooks, commitlint Conventional Commit validation with lowercase type and Korean summary, optional branch guard scripts, GitHub Actions CI, and optional GitHub branch protection. Use when Codex needs to document or apply commit policy, branch policy, Husky hooks, CI, or branch protection.
---

# Repo Guardrails

## Procedure

1. Inspect the target repo for existing `AGENTS.md`, Git workflow docs, Husky
   hooks, commitlint config, branch guard scripts, GitHub Actions workflows,
   package scripts, and GitHub remote.
2. Merge `references/agents-git-workflow-snippet.md` into `AGENTS.md` and write
   or merge `docs/engineering/git-workflow.md` from
   `references/git-workflow.md` when the user approves repo-local guardrail
   documentation.
3. Propose file changes before applying them. Dependency and lockfile changes
   require explicit approval.
4. Before installing branch guard hooks, confirm the target repository's branch
   guard profile from `AGENTS.md`, the user, or an existing project policy:
   - `policy-only`: document the policy but do not install branch-blocking hooks
   - `local-hooks`: block commits and pushes from the configured protected
     branches
   - `remote-protection`: document or apply GitHub branch protection after
     separate explicit approval
5. Copy or adapt the assets only for approved guardrail features:
   - `assets/commitlint.config.cjs` -> `commitlint.config.cjs`
   - `assets/guard-branch.mjs` -> `scripts/guard-branch.mjs`
   - `assets/husky-commit-msg` -> `.husky/commit-msg`
   - `assets/husky-pre-commit` -> `.husky/pre-commit`
   - `assets/husky-pre-push` -> `.husky/pre-push`
   - `assets/ci.yml` -> `.github/workflows/ci.yml`
6. Add or merge package scripts:
   - `prepare`: `husky`
   - `guard:branch`: `node scripts/guard-branch.mjs`
7. Add dev dependencies with approval:
   - `husky`
   - `@commitlint/cli`
   - `@commitlint/config-conventional`
   - `@biomejs/biome` when `code-style-baseline` is also applied
8. Make hook files executable after writing them.
9. Never mutate GitHub branch protection without explicit approval and a
   reachable GitHub remote.

## Commit Policy

Use `{type}: {summary}`.

- `type` must be lowercase.
- `type` must be one of the configured Conventional Commit types.
- scope syntax is disallowed by the default baseline.
- `summary` must include at least one Korean Hangul character.

Valid:

```text
feat: 로그인 실패 메시지 추가
fix: 버튼 비활성 상태 수정
chore: biome 설정 추가
```

Invalid:

```text
Feat: 로그인 실패 메시지 추가
feat(auth): 로그인 실패 메시지 추가
feat: add login error message
```

## Branch Guard

Direct commits or pushes to `main` are not mandatory for every repository. Treat
branch blocking as an optional guardrail selected per target repo.

When `local-hooks` is selected, the default protected branches are `main`,
`master`, and `develop`. The target repo may configure additional protected
branches through the `PROTECTED_BRANCHES` environment variable or by adapting the
installed hook. When `policy-only` is selected, document the expected workflow in
`AGENTS.md` and do not install branch-blocking hooks.

## GitHub Branch Protection

Use `references/github-branch-protection.md` when the user asks to configure or
verify remote protection. Prefer GitHub UI or `gh api` only after explicit
approval. Require status checks for the CI workflow when available.

## References

- `references/github-branch-protection.md`
- `references/guardrails-checklist.md`
- `references/git-workflow.md`
- `references/agents-git-workflow-snippet.md`
