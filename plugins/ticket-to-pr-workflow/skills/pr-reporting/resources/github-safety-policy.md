# GitHub Safety Policy

- Dry-run is the default.
- `--execute` is the explicit approval marker for the local execution script.
- Require a passed `storybook-report.md`, or an explicit
  `--approve-storybook-skip` for a recorded skipped result.
- Require a passed `browser-verification-report.md`, or an explicit
  `--approve-browser-skip` for a recorded skipped result.
- Never execute when either delivery report is missing, failed, or
  approval-required.
- Recheck verification, branch, worktree changes, origin, commit policy, Git
  identity, GitHub CLI authentication, package approval, secret paths, and
  remote ancestry immediately before execution.
- Never force push.
- Never push `main`, `master`, or `develop` directly.
- Stage only the files assigned to the current planned commit.
- Do not print credentials, tokens, or credential-bearing remote URLs.
- Disable Git credential, SSH password, GitHub CLI, and commit-signing prompts
  during automated execution.
- Do not wait for GitHub Actions.
- If authenticated `gh` is unavailable, keep the commands in `pr-plan.md` and
  do not start commits or push.
