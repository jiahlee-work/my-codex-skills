# Next.js Layered Architecture

This document defines the default structure for Next.js App Router projects.
The goal is to keep route files thin, make feature ownership obvious, and avoid
mixing UI, product flow, and external integration code in the same place.

Use this question when placing code:

```text
For what reason will this code change?
```

## Source Shape

```text
public/
  assets/
app/
src/
  presentation/
    components/
    features/
    layouts/
    providers/
  application/
    hooks/
    services/
    state/
    logging/
  infrastructure/
    apis/
    network/
    clients/
    storage/
    mappers/
  shared/
    types/
    constants/
    utils/
    schemas/
    errors/
    guards/
  types/
```

The three product layers are:

- `presentation`: what users see and interact with
- `application`: what the product does in response to user intent
- `infrastructure`: how the product talks to external systems

`app`, `shared`, and `types` are supporting boundaries. They are not product
behavior layers.

The usual flow is:

```text
User
  -> Presentation
  -> Application
  -> Infrastructure
  -> API, database, browser API, SDK, or external service
```

## `app/`

Root `app/` owns Next.js routing, route segment files, and framework
composition.

Allowed:

- `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- `not-found.tsx`, `global-error.tsx`, `template.tsx`, `default.tsx`
- route groups, dynamic segments, parallel routes, and intercepting routes
- `route.ts`
- metadata files, metadata exports, and route segment configuration
- a small provider composition boundary

Route entries should delegate to lower layers:

```tsx
import SubscriptionHistoryPage from "@/presentation/features/subscription/history";

export default function Page() {
  return <SubscriptionHistoryPage />;
}
```

Do not put complex UI, reusable product logic, state stores, server-state hooks,
API clients, SDK initialization, or shared utilities in `app/`.

Framework-required root files such as `proxy.ts`, `src/proxy.ts`,
`instrumentation.ts`, `src/instrumentation.ts`, `instrumentation-client.ts`, and
`src/instrumentation-client.ts` stay where Next.js requires them. Treat them as
framework boundaries, not as `shared` utilities.

## `src/presentation`

`presentation` owns visible UI and interaction composition.

Use it for:

- feature screens and page-level UI composition
- reusable React components
- forms, tables, modals, cards, navigation, and layouts
- loading, empty, error, disabled, and skeleton states
- event handlers that are local to UI behavior
- styling, class composition, and UI provider wrappers

Prefer feature screens under:

```text
src/presentation/features/<route-or-domain>/
```

Presentation may call application hooks and services. It should not initialize
HTTP clients, Firebase, analytics SDKs, storage clients, or other external
systems. It should not own transport DTOs or low-level response mapping.

## `src/application`

`application` owns user intent, product flow, and state orchestration.

Use it for:

- use cases and product services
- server-state hooks such as React Query hooks
- cache keys, retry policy, and invalidation policy
- application state stores and state adapters
- reusable application hooks
- orchestration across multiple infrastructure calls
- application-level success, failure, and logging flow

Application code may import infrastructure and shared code. It should not render
JSX, own CSS, construct concrete HTTP clients, initialize SDKs, or decide visual
layout.

Example:

```ts
import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "@/infrastructure/apis/payment";

export function useSubscriptionHistory() {
  return useQuery({
    queryKey: ["payment", "subscription-history"],
    queryFn: paymentApi.getSubscriptionHistory,
  });
}
```

## `src/infrastructure`

`infrastructure` owns concrete technical integrations.

Use it for:

- REST, GraphQL, fetch, Axios, and RPC implementations
- request and response DTOs
- response mappers and transport error conversion
- database, cache, storage, and external SDK clients
- browser API integrations such as files, audio, clipboard, and local storage
- low-level retry, timeout, and network behavior

Infrastructure code should not know whether data appears in a table, card, modal,
or chart. It must not import presentation or application code.

Example:

```ts
import { httpClient } from "@/infrastructure/network/http-client";

export const paymentApi = {
  async getSubscriptionHistory() {
    const response = await httpClient.get("/payment/subscription/history");
    return response.data;
  },
};
```

## `src/shared`

`shared` owns stable, neutral code that is reusable across layers.

Use it for:

- common types and enums
- constants such as route paths and storage keys
- pure formatters and utilities
- schemas, validators, and type guards
- common error types

`shared` is not a dumping ground for code that does not have an obvious home.
If code belongs to one feature or one layer, keep it near that owner.

## `src/types`

Use `src/types` only for ambient declarations and type overrides that must be
written as `.d.ts` files.

Use it for:

- module augmentation
- global declarations
- third-party package type overrides
- asset or environment module declarations

Do not put normal imported product types here. Put neutral imported types in
`src/shared/types`, and keep feature-specific types near the owning feature.

## Dependency Rules

| Importing boundary | May import |
| --- | --- |
| `app` | `presentation`, `application`, `infrastructure`, `shared` |
| `presentation` | `presentation`, `application`, `infrastructure`, `shared` |
| `application` | `application`, `infrastructure`, `shared` |
| `infrastructure` | `infrastructure`, `shared` |
| `shared` | `shared` |
| `types` | ambient declarations only |

Forbidden examples:

```text
infrastructure -> application
infrastructure -> presentation
application -> presentation
shared -> presentation
shared -> application
shared -> infrastructure
```

Prefer `application` between presentation and infrastructure when a call
represents a user flow, cache policy, state transition, or reusable use case.

## Import Rules

Configure the root source alias:

```json
{
  "@/*": ["./src/*"]
}
```

Use `@/...` for cross-layer imports:

```ts
import Button from "@/presentation/components/button";
import { useSubscriptionHistory } from "@/application/hooks/use-subscription-history";
import { paymentApi } from "@/infrastructure/apis/payment";
import { ROUTE_PATHS } from "@/shared/constants/route-paths";
```

Relative imports are acceptable between nearby files in the same feature folder.
Avoid imports that climb two or more parent directories.

## Placement Sequence

Ask these questions in order:

1. Is it a Next.js route, layout, loading/error boundary, route handler, or
   metadata file? Put it in root `app/`.
2. Is it visible UI or interaction composition? Put it in `src/presentation`.
3. Does it decide when or why an action occurs, manage state, or implement a
   user flow? Put it in `src/application`.
4. Does it implement communication with an external system, browser API, or
   technical library? Put it in `src/infrastructure`.
5. Is it a stable neutral type, constant, schema, guard, or pure utility used
   across layers? Put it in `src/shared`.
6. Is it an ambient declaration or module augmentation? Put it in `src/types`.
7. If none apply, keep it close to the feature that owns it instead of forcing it
   into `shared`.

## Naming Rules

- Use kebab-case file names.
- Prefix React hooks with `use`.
- Name API clients `<domain>Api`.
- Use `<domain>.dto.ts` for transport types.
- Use `<domain>.mapper.ts` for transport-to-product mapping.

Examples:

```text
use-subscription-history.ts
subscription-history-table.tsx
payment.dto.ts
payment.mapper.ts
route-paths.ts
```

## Review Checklist

- Is root `app/` limited to routing and composition?
- Does each feature screen live under `presentation/features`?
- Are user flows, cache policy, and state orchestration in `application`?
- Are concrete external calls, DTOs, and SDK clients in `infrastructure`?
- Does every `shared` file meet the neutral reuse criteria?
- Do imports follow the allowed dependency direction?
- Does `@/*` resolve to `src`?
- Are deep parent-directory imports avoided?
- Are file names kebab-case?
- Are Server and Client Component boundaries still valid?
- Did lint, typecheck, tests, and build pass?
