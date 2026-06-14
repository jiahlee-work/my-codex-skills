---
name: nextjs-layered-architecture
description: "Scaffold, organize, extend, migrate, and audit Next.js App Router projects around three core product layers: presentation, application, and infrastructure, with src/app as a thin framework boundary and src/shared as a neutral supporting area. Use when Codex needs to create or repair an App Router structure, decide where new code belongs, add a route or feature, configure the root @/* TypeScript path alias, rewrite non-canonical imports to @/... imports, move product code out of app, or check layer boundaries and naming rules."
---

# Next.js Layered Architecture

Organize product code around three core layers:

```text
Presentation -> Application -> Infrastructure
```

- `presentation`: how users see and interact with the product
- `application`: what the product does in response to user intent
- `infrastructure`: how external systems and technical capabilities are used

Treat the remaining source areas as supporting boundaries:

- `app`: Next.js routing and framework composition
- `shared`: stable, neutral concepts reused across layers
- `types`: ambient declarations and module augmentation in `.d.ts` files

```text
public/
  assets/
src/
  app/
  types/
  presentation/
  application/
  infrastructure/
  shared/
```

## Purpose

Separate UI, application behavior, and external integrations because they
change for different reasons. Without this separation, route files tend to own
rendering, state, caching, and requests together; components depend directly
on SDKs; and design or API changes spread into unrelated code.

Use this question when placing code:

> For what reason will this code change?

The separation provides predictable file placement, smaller change scope,
clearer test boundaries, technology isolation, and narrower Client Component
boundaries.

This is an executable architecture policy rather than only documentation. It
combines the placement rules with deterministic structure setup and
TypeScript-AST import validation so implementation does not drift from the
contract.

## References

Read only the reference needed for the task:

- Read [references/architecture-contract.md](references/architecture-contract.md)
  before changing structure, reviewing dependencies, or handling
  Server/Client Component boundaries.
- Read [references/placement-guide.md](references/placement-guide.md) when
  deciding a concrete file location, naming a file, implementing the
  subscription-history example, or migrating existing code.

## Workflow

1. Inspect `package.json`, the route directory, the source layout, and
   `tsconfig.json` or `jsconfig.json`.
2. Confirm that the target uses Next.js App Router. Do not apply this skill to
   a Pages Router-only, Expo, or non-Next.js project.
3. Determine whether the task is setup, feature placement, migration, or
   architecture audit.
4. Read the relevant reference and preserve valid project conventions that do
   not conflict with the architecture contract.
5. Make the smallest coherent change.
6. Run the relevant architecture check plus the project's existing lint,
   typecheck, tests, or build.

## Setup

Preview changes before writing:

```bash
./scripts/nextjs-layered-architecture.sh setup \
  --project <project-root> \
  --dry-run
```

Apply the setup:

```bash
./scripts/nextjs-layered-architecture.sh setup \
  --project <project-root>
```

The setup command:

- verifies that `next` is declared
- rejects an unreviewed root `app/` or Pages Router-only layout
- creates the standard layer directories
- creates `public/assets` and `src/types`
- configures the root `@/*` alias
- preserves existing source files and dependencies

Do not automatically move a root `app/` directory. Route groups, parallel
routes, intercepting routes, metadata, relative imports, and Server/Client
Component boundaries require code-aware migration.

Do not rewrite JSONC configuration by default. Preserve comments manually, or
use `--force` only when intentionally replacing a conflicting alias or
rewriting JSONC as JSON.

## Place Code

Classify new code in this order:

1. Next.js route, layout, route handler, metadata, or framework boundary:
   `src/app`
2. Visible UI or interaction composition: `src/presentation`
3. User flow, use case, server-state handling, application state, or policy:
   `src/application`
4. API, database, Firebase, SDK, browser, or network implementation:
   `src/infrastructure`
5. Stable cross-layer type, constant, schema, guard, or pure utility:
   `src/shared`
6. Ambient declaration, module augmentation, or third-party type override:
   `src/types`

Keep `page.tsx` and `route.ts` thin. They may compose lower areas but must not
own reusable product behavior.

Preserve the core `presentation -> application -> infrastructure` direction.
Allow `presentation -> infrastructure` only for a narrow technical capability
that is not a user flow, state policy, or reusable use case.

Keep Server Components as the default. Add `"use client"` at the narrowest
presentation boundary that requires hooks, browser APIs, or interactive state.

## Migrate Existing Code

Run the complete audit described below before moving files.

Migrate one responsibility chain at a time:

- route-owned UI to `presentation`
- user flows and state to `application`
- external integrations to `infrastructure`
- only neutral, stable concepts to `shared`

Update cross-folder imports to the `@/*` alias and verify after each coherent
move. Keep short sibling imports such as `./subscription-history-table`, but
replace imports that climb two or more parent directories with `@/...`. Also
rewrite legacy explicit layer aliases such as `@application/...` to
`@/application/...`.
Read imports, exports, callers, and runtime directives instead of inferring
ownership from the current folder name.

To rewrite non-canonical imports automatically:

```bash
./scripts/nextjs-layered-architecture.sh fix-imports \
  --project <project-root> \
  --dry-run

./scripts/nextjs-layered-architecture.sh fix-imports \
  --project <project-root>
```

This is the safe auto-fix boundary for the skill. It rewrites resolvable deep
relative imports and legacy explicit layer aliases to `@/...`. Editor save
hooks are project-specific; when requested, wire this command into the
project's editor or lint-on-save workflow instead of assuming the skill can
intercept saves.

Before rewriting imports, `fix-imports` checks root ESLint configuration for
known import path rewrite rules. If ESLint already owns import path rewriting,
the command skips changes to avoid save-time conflicts. Use `--force` only
when intentionally overriding that guard.

## Audit

Run the complete architecture audit:

```bash
./scripts/nextjs-layered-architecture.sh audit \
  --project <project-root>
```

Run only the import boundary check:

```bash
./scripts/nextjs-layered-architecture.sh boundary-check \
  --project <project-root>
```

Add `--json` for machine-readable output.

The audit checks structure, the root `@/*` alias, thin `src/app` boundaries,
JSX placement, kebab-case names, non-canonical imports, and forbidden imports.
Run `fix-imports` before `audit` when the task should auto-correct import
style. AST-based checks require an available `typescript` package. Do not add a
dependency without approval; install the project's existing dependencies first.

## Report

Report:

- directories and configuration changed
- files moved and their new ownership
- validation commands and results
- unresolved warnings or skipped checks
