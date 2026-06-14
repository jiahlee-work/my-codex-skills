# Storybook Setup Policy

- Never install dependencies or edit package, lock, `.storybook`, or story
  files before explicit approval.
- `--execute-setup` is the local CLI approval marker for the proposed setup.
- `--skip-install` must not mutate repository setup.
- Prefer the official Storybook initializer for the detected package manager.
- A custom internal setup command may be supplied with `--setup-command` only
  after the user specifies that convention.
- Record approval, command outcome, and changed setup files in Storybook
  artifacts and the shared `agent-run-report.md`.
- Stop if setup remains incomplete or requires an additional dependency or
  convention decision.
