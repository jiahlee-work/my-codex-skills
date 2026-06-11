# Architecture Contract

## Contents

1. Source shape
2. Layer responsibilities
3. Dependency rules
4. App Router boundaries
5. Server and Client Components
6. Shared eligibility

## Source Shape

```text
public/
  assets/
src/
  app/
  types/
  presentation/
    components/
    features/
    layouts/
    providers/
  application/
    hooks/
    logging/
    services/
  infrastructure/
    apis/
    network/
    utils/
  shared/
    types/
    constants/
    utils/
    schemas/
    errors/
    guards/
```

The architecture has three core product layers:

- visual design and interaction changes belong to `presentation`
- user flows, state, and use cases belong to `application`
- external systems and technical integrations belong to `infrastructure`

`app` is the Next.js framework entry boundary, and `shared` is a neutral
supporting area. They are not additional product behavior layers.

The usual runtime flow is:

```text
User
  -> Presentation
  -> Application
  -> Infrastructure
  -> API, database, Firebase, browser, or external service
```

## Layer Responsibilities

### app

`src/app` owns only Next.js routing boundaries and composition.

Allowed:

- `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- `not-found.tsx`, `global-not-found.tsx`, `default.tsx`, `template.tsx`
- `global-error.tsx`, `forbidden.tsx`, `unauthorized.tsx`
- `route.ts`
- Next.js metadata files and static route assets
- route metadata and segment configuration
- a small `providers.tsx` composition boundary

Keep framework-level files such as `src/proxy.ts`,
`src/instrumentation.ts`, and `src/instrumentation-client.ts` at the location
required by Next.js. They are framework entry boundaries outside the product
layers, not candidates for `shared`.

Do not place these in `app`:

- complex UI implementations
- screen-level business logic
- server-state hooks or application state stores
- API request functions or HTTP clients
- Firebase or external SDK initialization
- shared utilities

An App Router file may compose lower layers but must not own reusable product
logic.

### presentation

Own what the user sees and interacts with:

- React components and feature screens
- buttons, modals, forms, tables, and layouts
- loading, error, empty, and skeleton states
- event handling and UI composition
- styling, internationalization, and UI providers

Prefer feature screens under:

```text
src/presentation/features/<route-or-domain>/
```

Do not initialize Axios, Firebase, Redis, or external SDKs here. Do not define
transport DTOs or own network error conversion here.

### application

Own user intent and application flow:

- use cases and orchestration across infrastructure functions
- React Query hooks and cache/retry policy
- application state and state-management adapters chosen by the project
- reusable application hooks
- success, failure, and application-level logging flow

Do not put JSX, visual components, CSS, HTTP client construction, SDK
initialization, or concrete browser integration details here.

### infrastructure

Own concrete interaction with external systems:

- REST, GraphQL, Axios, and fetch implementations
- request and response DTOs
- response mappers
- database, cache, and external SDK clients selected by the project
- browser APIs, files, PDF, audio, and storage implementations
- network error conversion and technical retry behavior

Infrastructure must not know whether a result is shown in a table, card, modal,
or another visual form. Do not place server-state hooks, application state,
JSX, or screen-specific user flows here.

### shared

Own only neutral concepts that can be used from multiple layers:

- common types, constants, and enums
- pure formatters and utility functions
- common schemas, validators, and type guards
- common error types
- route paths, storage keys, pagination types

`shared` is not a `common`, `misc`, or generic `utils` dumping ground.

### types

Use `src/types` only for ambient declarations and type overrides that must be
expressed as `.d.ts` files:

- module augmentation
- global declarations
- third-party package type overrides
- asset or environment module declarations

Do not place normal imported product types here. Put neutral imported types in
`src/shared/types`, and keep feature-specific types near their owning layer.

## Dependency Rules

| Importing layer | May import |
| --- | --- |
| `app` | `app`, `presentation`, `application`, `infrastructure`, `shared` |
| `presentation` | `presentation`, `application`, `infrastructure`, `shared` |
| `application` | `application`, `infrastructure`, `shared` |
| `infrastructure` | `infrastructure`, `shared` |
| `shared` | `shared` |

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
The contract permits presentation to import infrastructure for a narrow,
presentation-specific technical need, but do not bypass application ownership
for normal product flows.

Configure these aliases:

```json
{
  "@/*": ["./src/*"],
  "@application/*": ["./src/application/*"],
  "@infrastructure/*": ["./src/infrastructure/*"],
  "@presentation/*": ["./src/presentation/*"],
  "@shared/*": ["./src/shared/*"]
}
```

Use the explicit layer aliases for cross-layer imports:

```ts
import Button from "@presentation/components/button";
import { useSubscriptionHistory } from "@application/hooks/api/payment/use-subscription-history";
import { paymentApi } from "@infrastructure/apis/payment";
import { ROUTE_PATHS } from "@shared/constants/route-paths";
```

Relative imports are acceptable between small neighboring files:

```ts
import { SubscriptionHistoryTable } from "./subscription-history-table";
```

## App Router Boundaries

A route entry should delegate:

```tsx
import SubscriptionHistoryPage from "@presentation/features/my/subscription/history";

export default function Page() {
  return <SubscriptionHistoryPage />;
}
```

Use route groups, dynamic segments, parallel routes, and intercepting routes
inside `src/app` as Next.js requires. Their route files remain thin even when
the directory topology is complex.

Keep route handlers thin as well:

```ts
import { getPaymentHistory } from "@application/services/payment/get-payment-history";

export async function GET() {
  const history = await getPaymentHistory();
  return Response.json(history);
}
```

## Server and Client Components

- Keep Server Components as the default.
- Add `"use client"` only where hooks, browser APIs, interactive state, or
  client-only libraries require it.
- Prefer a client `presentation` feature under a server `page.tsx`.
- Keep server-only credentials and SDKs in server-safe infrastructure modules.
- Do not import server-only infrastructure into Client Components.
- Split infrastructure modules into explicit server/client implementations
  when an integration spans both runtimes.
- Treat client-side server-state and state-management entry points as
  application code.

Layer ownership and runtime ownership are separate checks. A file can be in the
correct layer and still violate a Server/Client Component boundary.

## Shared Eligibility

Place code in `shared` only when all are true:

1. It is not specific to one screen.
2. It is not specific to one use case.
3. It is not specific to one API implementation.
4. Multiple layers can use it without reversing responsibility.
5. It is pure or represents a stable common concept.

When only one feature uses a type or utility, keep it with that feature or
owning layer until real cross-layer reuse exists.
