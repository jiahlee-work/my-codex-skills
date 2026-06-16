# Testing

Testing rules define when and how agents should protect behavior. They do not
choose a test runner, test framework, setup file, or package script.

## Principles

- Tests should protect behavior, not implementation details.
- When a repository has testing tools, follow that repository's existing
  toolchain and conventions.
- When no testing tools exist, do not introduce one unless the user explicitly
  asks.
- Prefer focused tests near the changed behavior.
- Avoid broad snapshots unless the snapshot is intentionally reviewed and
  stable.
- Place tests near the code they cover in a `__tests__` folder.
- Name tests `*.test.ts` for non-React TypeScript and `*.test.tsx` for React
  component tests.

## File Placement

Use colocated `__tests__` folders:

```text
src/application/services/payment.ts
src/application/services/__tests__/payment.test.ts

src/presentation/components/button.tsx
src/presentation/components/__tests__/button.test.tsx
```

## When To Add Or Update Tests

- Add or update tests when fixing a bug.
- Add or update tests when changing logic, parsing, validation, data mapping,
  async behavior, state transitions, or user interaction.
- Consider component tests for important UI states such as loading, empty,
  error, disabled, and successful submission.
- Tests may be unnecessary for docs-only, style-only, formatting-only, or
  type-only changes.

## Test Quality

- Test observable behavior and outcomes.
- Control time, randomness, network, storage, and browser APIs with fakes or
  mocks when needed.
- Include meaningful failure and edge cases.
- Keep test names descriptive enough to explain the expected behavior.
