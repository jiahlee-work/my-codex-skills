---
name: react-typescript-coding-style
description: Apply React, Next.js, and TypeScript coding style rules during implementation, refactoring, review, and verification. Use when Codex edits or reviews TSX/JSX React components, Next.js UI code, hooks, event handlers, derived state, className composition, component splitting, exports, comments, or Biome-backed style failures.
---

# React TypeScript Coding Style

## Procedure

1. Read `resources/coding-style-guide.md` before changing or reviewing React,
   Next.js, or TypeScript UI code.
2. Apply the guide to files you touch and the directly surrounding code needed
   to keep the change coherent. Do not broad-reformat or style-refactor
   unrelated files.
3. Prefer explicit user instructions and established project conventions when
   they conflict with this guide. Record intentional exceptions in the relevant
   implementation, review, or verification report.
4. Let Biome own import ordering, formatting, nested ternary checks, and block
   statement enforcement when the target repository configures those rules. Do
   not work around Biome failures; either fix the touched code or report the
   required follow-up in the current workflow phase.

## Ticket Workflow Integration

- `ticket-code-worker`: during codebase analysis and implementation, use this
  skill for changed React, Next.js, and TypeScript UI files. Include any
  intentional style-guide exception in `code-review-report.md`.
- `verification-runner`: during failure analysis, interpret Biome, lint,
  typecheck, or test failures against this guide when changed TSX/JSX/UI files
  are involved. Do not modify files during verification; report actionable
  style fixes in `failure-report.md` or `verification-report.md`.

## Fast Checklist

- Destructure component props inside the function unless the component is
  intentionally trivial.
- Keep component declarations in the documented order: props, external hooks,
  local constants, state, derived values, handlers, effects, early returns,
  render.
- Name booleans with `is`, `has`, `can`, or `should`.
- Use `on*` for injected callbacks and `handle*` for internal event handlers.
- Do not store values in state when they can be derived from props or state.
- Use `useEffect` only to synchronize with external systems.
- Place early returns after hook declarations and before the final render.
- Use plain `className` strings for simple classes and `cn()` for conditional
  classes.
- Split components by responsibility and readability, not only by reuse.
- Extract complex JSX conditions into named boolean variables.
- Comment why code exists, not what obvious code does.
- Export only the file's primary component unless external use requires more.
- Avoid nested ternaries and one-line control-flow blocks; rely on Biome when
  configured.

## Resource

- Full guide: `resources/coding-style-guide.md`
