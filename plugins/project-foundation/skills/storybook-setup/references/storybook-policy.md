# Storybook Policy

- Storybook setup and story writing are repository mutations and require user
  approval.
- Prefer official initializer output over hand-written dependency lists.
- Preserve existing addons, framework adapter, and preview decorators.
- When creating stories, cover meaningful UI states rather than only a default
  happy path.
- If a component requires app providers, create decorators or local mocks instead
  of importing production-only services directly.
