# Story Writing Policy

- Default to dry-run planning.
- Write stories only with `--write-stories` or equivalent explicit approval.
- Reuse existing naming, decorators, providers, fixtures, and mock boundaries.
- Do not change component implementation to make a story easier to write.
- Do not introduce design changes.
- Generate a new story automatically only when the component export and props
  are simple enough to produce a conservative valid story.
- Leave complex required props, provider setup, network mocks, and existing
  story updates for explicit implementation using `storybook-plan.md`.
- Stop and request approval if a new dependency is required.
- Record every written story in `stories-changed.json` and
  `changed-files.json`.
