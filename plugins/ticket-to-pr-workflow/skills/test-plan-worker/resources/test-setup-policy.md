# Test Setup Policy

Do not install or configure a test stack automatically.

When setup is missing or insufficient:

1. Write `test-setup-proposal.md`.
2. Present Vitest + Testing Library, Jest + Testing Library, Playwright, MSW,
   and Custom options.
3. Require explicit user approval before dependency installation or changes to
   package files, lockfiles, configs, setup files, or test files.
4. Do not finalize `test-plan.md` until the setup is available or the user has
   approved a proposed stack.

Record the approved stack in `test-setup-proposal.md` and the shared
`agent-run-report.md`.
