## Next.js Architecture

- Next.js App Router projects must follow `docs/engineering/nextjs-layered-architecture.md`.
- Keep `src/app` as a thin routing and framework composition boundary.
- Place product code in three core layers: `src/presentation`, `src/application`, and `src/infrastructure`.
- Use `src/shared` only for stable neutral code reused across layers.
- Use `src/types` only for ambient declarations and module augmentation.
- Prefer `@/...` imports for cross-layer imports and avoid deep parent-directory imports.
