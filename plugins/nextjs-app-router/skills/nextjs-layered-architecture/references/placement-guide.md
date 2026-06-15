# Placement Guide

## Contents

1. Decision sequence
2. Naming rules
3. Subscription history example
4. Migration guidance
5. Review checklist

## Decision Sequence

Ask these questions in order:

1. Is it a Next.js route, layout, loading/error boundary, route handler, or
   metadata file?
   - Place it in root `app/`.
   - Keep framework root boundaries such as `proxy.ts` and
     `instrumentation.ts` at the root or `src/` location Next.js requires.
2. Is it visible UI or interaction composition?
   - Place it in `src/presentation`.
3. Does it decide when or why an action occurs, manage state, or implement a
   user flow?
   - Place it in `src/application`.
4. Does it implement communication with an external system, browser API, or
   technical library?
   - Place it in `src/infrastructure`.
5. Is it a stable and neutral type, constant, schema, guard, or pure utility
   used across layers?
   - Place it in `src/shared`.
6. Is it an ambient declaration, module augmentation, or third-party type
   override written as a `.d.ts` file?
   - Place it in `src/types`.
7. If none apply, keep it close to the feature that owns it instead of forcing
   it into `shared`.

Use the question "For what reason will this code change?" as the final tie
breaker.

## Naming Rules

Use kebab-case file names:

```text
use-subscription-history.ts
subscription-history-table.tsx
payment.dto.ts
payment.mapper.ts
route-paths.ts
```

Use `use` for React hooks:

```text
useSubscriptionHistory
usePaymentMethod
useAuthSession
```

Use `<domain>Api` for API objects:

```text
paymentApi
userApi
authApi
```

Use `<domain>.dto.ts` for transport types and `<domain>.mapper.ts` when
converting external responses into internal shapes.

## Subscription History Example

```text
app/my/subscription/history/page.tsx
  -> src/presentation/features/my/subscription/history/index.tsx
  -> src/application/hooks/api/payment/use-subscription-history.ts
  -> src/infrastructure/apis/payment/index.ts
  -> API server
```

Route entry:

```tsx
import SubscriptionHistoryPage from "@/presentation/features/my/subscription/history";

export default function Page() {
  return <SubscriptionHistoryPage />;
}
```

Presentation:

```tsx
"use client";

import { useSubscriptionHistory } from "@/application/hooks/api/payment/use-subscription-history";
import { SubscriptionHistoryEmpty } from "./subscription-history-empty";
import { SubscriptionHistorySkeleton } from "./subscription-history-skeleton";
import { SubscriptionHistoryTable } from "./subscription-history-table";

export default function SubscriptionHistoryPage() {
  const { data, isError, isLoading } = useSubscriptionHistory();

  if (isLoading) return <SubscriptionHistorySkeleton />;
  if (isError) return <p>Unable to load subscription history.</p>;
  if (!data?.length) return <SubscriptionHistoryEmpty />;

  return <SubscriptionHistoryTable items={data} />;
}
```

Application:

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

Infrastructure:

```ts
import { httpClient } from "@/infrastructure/network/http-client";

export const paymentApi = {
  async getSubscriptionHistory() {
    const response = await httpClient.get("/payment/subscription/history");
    return response.data;
  },
};
```

Shared:

```ts
export type Pagination = {
  page: number;
  size: number;
  totalCount: number;
};
```

Each file has one ownership reason:

- `page.tsx`: route entry
- presentation feature: visual states and composition
- application hook: query timing and cache behavior
- infrastructure API: concrete request and response handling
- shared type: neutral cross-layer concept

## Migration Guidance

Before moving files:

1. Run the architecture audit.
2. List files currently owned by `app`.
3. Group them by UI, application flow, integration, or neutral shared concept.
4. Move one coherent dependency chain at a time.
5. Run `fix-imports` or manually update cross-folder imports to the `@/*`
   alias.
6. Run typecheck and boundary checks after each group.

Do not infer ownership from the current directory name. Read imports, exports,
runtime directives, and callers.

When moving from `src/app` to root `app/`:

- preserve route groups such as `(marketing)`
- preserve dynamic and catch-all segments
- preserve parallel route slots such as `@modal`
- preserve intercepting route notation
- verify metadata and static route assets
- repair relative imports that assumed the `src` directory
- verify middleware and instrumentation locations separately

## Review Checklist

- Is root `app/` limited to routing and composition?
- Does each feature screen live under `presentation/features`?
- Are server-state and application-state concerns in `application`?
- Are concrete external calls and DTOs in `infrastructure`?
- Does every `shared` file meet the neutral reuse criteria?
- Do imports follow the allowed direction?
- Does the root `@/*` alias resolve to `src`?
- Are imports that climb two or more parent directories replaced with `@/...`?
- Are legacy aliases such as `@application/...` replaced with
  `@/application/...`?
- Are source file names kebab-case?
- Are Server/Client Component boundaries still valid?
- Did the project's lint, typecheck, tests, and build pass?
