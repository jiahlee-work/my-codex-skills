# GitHub Branch Protection

Use this policy only after the user approves remote GitHub settings changes.

Use remote branch protection only when the repository selects the
`remote-protection` guardrail profile. Recommended protection for the selected
default branch, commonly `main`:

- Require a pull request before merging.
- Require at least one approval.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merge.
- Require status checks to pass before merge.
- Require the repository CI workflow status.
- Require branches to be up to date before merge when the team accepts the
  additional friction.
- Restrict force pushes.
- Restrict branch deletion.
- Include administrators when the repository should not allow emergency direct
  pushes.

Do not rely only on branch protection when the repository selected
`local-hooks`. Local branch guards catch mistakes earlier; GitHub branch
protection is the final server-side backstop.
