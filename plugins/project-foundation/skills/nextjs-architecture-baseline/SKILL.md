---
name: nextjs-architecture-baseline
description: Install or update repo-local Next.js App Router layered architecture documentation. Use when Codex needs to add docs/engineering/nextjs-layered-architecture.md, AGENTS architecture instructions, or a 3-layer presentation, application, and infrastructure structure guide for Next.js repositories.
---

# Next.js Architecture Baseline

## Procedure

1. Inspect the target repository for Next.js App Router:
   - `next` dependency in `package.json`
   - `src/app` or `app` route directory
   - existing architecture docs or `AGENTS.md` architecture instructions
2. Mark this baseline `not-applicable` for non-Next.js repositories or
   Pages Router-only projects unless the user explicitly wants the document as a
   future migration guide.
3. Keep the target repo as the source of truth:
   - Write `docs/engineering/nextjs-layered-architecture.md` from
     `references/nextjs-layered-architecture.md`.
   - Merge `references/agents-nextjs-architecture-snippet.md` into `AGENTS.md`.
4. Do not move files, create directories, rewrite imports, or refactor
   architecture during this baseline installation unless the user separately
   approves implementation work.
5. When architecture audit or migration is requested, prefer the separate
   `nextjs-layered-architecture` skill if it is available. This skill only
   installs the repo-local documentation baseline.

## Installed Files

- `docs/engineering/nextjs-layered-architecture.md`
- `AGENTS.md` architecture snippet

## References

- `references/nextjs-layered-architecture.md`
- `references/agents-nextjs-architecture-snippet.md`
