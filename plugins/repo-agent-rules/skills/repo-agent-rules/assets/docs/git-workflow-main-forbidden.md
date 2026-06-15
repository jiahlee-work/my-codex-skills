# Git Workflow

This document defines common Git rules for agents and the minimal hook policy
that enforces them.

## Working Tree

- Check `git status --short` before making changes.
- Preserve user changes and unrelated dirty files.
- Do not run destructive commands such as `git reset --hard` or
  `git checkout -- <path>` unless the user explicitly asks.
- Keep commits focused on the requested work.

## Branch Policy

- Direct commits and pushes to `main` or `master` are forbidden.
- Work on a feature branch unless the user explicitly gives a different branch
  workflow.
- The pre-push hook runs `scripts/guard-branch.mjs` to block pushes from
  protected branches.

## Commit Messages

Use Conventional Commits with optional scope:

```text
<type>[optional scope]: <description>
```

Allowed:

```text
feat: add login form
feat(auth): add login form
fix: 로그인 오류 수정
chore(deps): update husky
```

English and Korean descriptions are both allowed.

## Hook Policy

- `commit-msg` runs commitlint.
- `pre-commit` blocks obvious secret files from being committed.
- `pre-push` blocks pushes from protected branches.
