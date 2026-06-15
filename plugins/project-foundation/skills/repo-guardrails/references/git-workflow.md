# Git Workflow

This policy defines the default Git and delivery guardrails for the repository.
The repository owns the final policy after setup; adapt it when the team needs a
different branch or commit model.

## Guardrail Profile

Choose one profile for this repository:

- `policy-only`: document the preferred workflow without installing
  branch-blocking hooks.
- `local-hooks`: install local Husky hooks that block commits and pushes from
  configured protected branches.
- `remote-protection`: configure GitHub branch protection after explicit
  approval. This can be combined with `local-hooks`.

Direct commits or pushes to `main` are not mandatory to block in every
repository. Treat branch blocking as an opt-in guardrail for repositories that
want that protection.

## Protected Branches

When branch blocking is enabled, protect these branches by default:

```text
main, master, develop
```

Change the list before installing hooks when the repository uses a different
branch strategy. Use `policy-only` when direct updates are intentionally allowed.

## Commit Messages

Use scope-free Conventional Commit messages:

```text
{type}: {Korean summary}
```

Examples:

```text
feat: 로그인 실패 메시지 추가
fix: 버튼 비활성 상태 수정
chore: biome 설정 추가
```

Default constraints:

- `type` is lowercase.
- `type` uses the configured Conventional Commit type list.
- scope syntax such as `feat(auth): ...` is not used.
- `summary` includes at least one Korean Hangul character.

## CI

GitHub Actions CI should run the repository's available checks in this order
when configured:

```text
install -> lint -> typecheck -> test -> build
```

Skip missing commands rather than adding unused scripts only for CI.
