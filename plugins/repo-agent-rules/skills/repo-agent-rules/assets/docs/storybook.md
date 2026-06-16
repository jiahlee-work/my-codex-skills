# Storybook

Storybook rules define when and where agents should add stories. They do not
choose a Storybook framework package, builder, addon set, or package script.

## Principles

- Add or update stories for reusable UI components and important UI states when
  a change affects presentation behavior.
- Prefer stories that show meaningful states: default, loading, empty, error,
  disabled, focused, and populated.
- Use realistic props and accessible labels.
- Do not create broad example stories unrelated to changed or reusable
  components.
- Do not introduce Storybook tooling unless the user explicitly asks.

## File Placement

Place stories next to the component they document:

```text
src/presentation/components/button.tsx
src/presentation/components/button.stories.tsx

src/presentation/features/login/login-form.tsx
src/presentation/features/login/login-form.stories.tsx
```

Use `*.stories.tsx` for React component stories.
