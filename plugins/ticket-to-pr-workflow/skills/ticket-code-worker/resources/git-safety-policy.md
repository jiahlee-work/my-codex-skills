# Git Safety Policy

Run the Git status check before code changes.

## Required Checks

- The repository is a Git worktree.
- The planned branch is extracted from `branch-commit-plan.md`.
- The branch passes `branch-commit-policy`.
- The worktree has no unapproved pre-existing changes.
- The planned branch does not already exist locally or on a remote.
- Branch creation succeeds before implementation starts.

Creating the planned branch from `main`, `master`, or `develop` is allowed only
while the worktree is clean. Product or test changes must never be made while
one of those protected branches remains checked out.

An explicit `--allow-dirty` flag represents recorded user approval to continue
with existing changes. It does not make protected-branch implementation safe.
An explicit `--approved-config-changes` flag represents recorded Test Planning setup
approval when that approval cannot be inferred from the run artifacts.

If the planned branch already exists, stop and report a suffix option such as
`-2`; do not overwrite, reset, or force-update it.
