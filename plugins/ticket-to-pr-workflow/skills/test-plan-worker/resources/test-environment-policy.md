# Test Environment Policy

Inspect the target repository before writing a test plan.

Check:

- `package.json` and pnpm, npm, or Yarn lockfiles
- Vitest, Jest, and Playwright config files
- `src/**/*.test.*`, `src/**/*.spec.*`, `__tests__/`, and `tests/`
- Vitest, Jest, Testing Library, Playwright, MSW, jsdom, and happy-dom dependencies
- `test`, `test:unit`, `test:watch`, and `test:e2e` package scripts

Treat a setup as insufficient when the repository has no supported runner or
command, or when the selected task needs browser/DOM behavior that the detected
stack cannot exercise.
