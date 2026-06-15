---
name: repo-guardrails
description: Install or update repository guardrails for Git hooks, commitlint Conventional Commit validation with lowercase type and Korean summary, custom branch guard scripts, GitHub Actions CI, and GitHub branch protection. Use when Codex needs to protect main from direct commits or pushes, add Husky hooks, enforce commit messages, or document/apply branch protection.
---

# Repo Guardrails

## Procedure

1. Inspect the target repo for existing Husky hooks, commitlint config, branch
   guard scripts, GitHub Actions workflows, package scripts, and GitHub remote.
2. Propose file changes before applying them. Dependency and lockfile changes
   require explicit approval.
3. Copy or adapt the assets:
   - `assets/commitlint.config.cjs` -> `commitlint.config.cjs`
   - `assets/guard-branch.mjs` -> `scripts/guard-branch.mjs`
   - `assets/husky-commit-msg` -> `.husky/commit-msg`
   - `assets/husky-pre-commit` -> `.husky/pre-commit`
   - `assets/husky-pre-push` -> `.husky/pre-push`
   - `assets/ci.yml` -> `.github/workflows/ci.yml`
4. Add or merge package scripts:
   - `prepare`: `husky`
   - `guard:branch`: `node scripts/guard-branch.mjs`
5. Add dev dependencies with approval:
   - `husky`
   - `@commitlint/cli`
   - `@commitlint/config-conventional`
   - `@biomejs/biome` when `code-style-baseline` is also applied
6. Make hook files executable after writing them.
7. Never mutate GitHub branch protection without explicit approval and a
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

The default branch guard blocks commits and pushes from `main`, `master`, and
`develop`. The target repo may configure additional protected branches through
the `PROTECTED_BRANCHES` environment variable.

## GitHub Branch Protection

Use `references/github-branch-protection.md` when the user asks to configure or
verify remote protection. Prefer GitHub UI or `gh api` only after explicit
approval. Require status checks for the CI workflow when available.

## References

- `references/github-branch-protection.md`
- `references/guardrails-checklist.md`
