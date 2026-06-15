## Git Workflow

- Follow `docs/engineering/git-workflow.md`.
- Branch guard profile is repository-specific:
  - `policy-only`: document the workflow but do not install branch-blocking hooks.
  - `local-hooks`: block commits and pushes from the configured protected branches.
  - `remote-protection`: use GitHub branch protection after explicit approval.
- Protected branches default to `main`, `master`, and `develop` only when
  `local-hooks` or `remote-protection` is selected. Edit this list or select
  `policy-only` when the repository intentionally allows direct updates.
- Use scope-free commit messages in the form `{type}: {Korean summary}` unless
  the repository documents a stricter policy.
