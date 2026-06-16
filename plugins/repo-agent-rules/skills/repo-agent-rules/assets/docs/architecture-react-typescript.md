# Architecture

This repository follows a React/TypeScript product layering model.

## Source Shape

```text
src/
  presentation/
  application/
  infrastructure/
  shared/
  types/
```

## Boundaries

- `src/presentation` owns visible UI, page or screen composition, forms, tables,
  dialogs, and interaction wiring.
- `src/application` owns user intent, product flow, state orchestration, cache
  policy, and use cases.
- `src/infrastructure` owns concrete external integrations, clients, transport
  DTOs, response mapping, browser APIs, and storage.
- `src/shared` owns stable neutral code that can be reused across boundaries.
- `src/types` owns ambient declarations and module augmentation.

## Rules

- Keep framework entry points thin.
- Keep dependency direction one-way:
  presentation -> application -> infrastructure -> external systems.
- Application code may coordinate infrastructure and shared code, but should not
  render UI.
- Infrastructure code must not depend on presentation or application.
- `shared` must stay neutral. It must not depend on presentation, application,
  or infrastructure.
- Keep feature-specific code near the feature that owns it instead of forcing it
  into `shared`.
- Use the configured `@/` alias for imports between files under `src/`. Do not
  use `./` or `../` for local imports inside `src`, including imports within
  the same feature folder.
