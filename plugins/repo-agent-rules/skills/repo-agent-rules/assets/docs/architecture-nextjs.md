# Architecture

This repository follows a Next.js App Router shape with root `app/` for routing
and `src/` for product code.

## Source Shape

```text
app/
src/
  presentation/
  application/
  infrastructure/
  shared/
  types/
```

## Boundaries

- `app/` owns route segment files, layouts, loading and error boundaries, route
  handlers, metadata, and framework composition.
- `src/presentation` owns visible UI, page composition, forms, tables, dialogs,
  and interaction wiring.
- `src/application` owns user intent, product flow, state orchestration, cache
  policy, and use cases.
- `src/infrastructure` owns concrete external integrations, clients, transport
  DTOs, response mapping, browser APIs, and storage.
- `src/shared` owns stable neutral code that can be reused across boundaries.
- `src/types` owns ambient declarations and module augmentation.

## Rules

- Keep route files thin. Route entries should delegate to lower layers.
- Do not put reusable product logic, API clients, state stores, or shared
  utilities in `app/`.
- Do not put `app/` under `src/`.
- Keep dependency direction one-way:
  presentation -> application -> infrastructure -> external systems.
- `shared` must stay neutral. It must not depend on presentation, application,
  or infrastructure.
- Follow the repository's configured import alias. If `@/*` maps to `./src/*`,
  use imports like `@/presentation/...`. If `@/*` maps to `./*`, use imports
  like `@/src/presentation/...`.
