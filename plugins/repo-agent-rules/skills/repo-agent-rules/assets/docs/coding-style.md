# Coding Style

These rules define common coding behavior for agents. They do not replace a
repository's formatter, linter, or type checker.

## General

- Make the smallest coherent change that satisfies the request.
- Prefer clear names over comments that restate code.
- Keep functions focused and move complex branching into named helpers.
- Use early returns to reduce nesting when it improves readability.
- Avoid broad refactors, file moves, or dependency changes unless the user asks.
- Preserve existing public APIs unless the request requires changing them.

## TypeScript

- Prefer precise types over `any`.
- Use `unknown` at external boundaries and narrow before use.
- Keep domain types close to the code that owns them unless they are truly
  shared.
- Avoid type assertions when a guard or parser can prove the type.
- Do not silence type errors without explaining why the code is safe.

## React

- Keep render logic readable and extract components when one component has
  multiple distinct responsibilities.
- Prefer derived values over duplicated state.
- Use effects for synchronization with external systems, not for ordinary data
  derivation.
- Name event handlers by user intent, such as `handleSubmit` or
  `handleDialogClose`.
- Keep loading, empty, error, disabled, and success states explicit when they
  are user-visible.

## Comments

- Add comments only when they explain non-obvious intent, constraints, or
  tradeoffs.
- Do not leave stale TODOs or comments that describe what a line of code already
  says.
