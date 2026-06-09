# Codebase Analysis Policy

Before editing, inspect:

- Related components, hooks, utilities, services, and API modules
- Existing implementations with similar behavior
- Nearby test files and fixtures
- Test libraries, environments, scripts, and naming conventions
- Code style, naming, import aliases, and path conventions
- State management and data-fetching patterns
- API and network mocking patterns

Prefer repository-local patterns over new abstractions. Record only the
analysis that materially affected the implementation in
`implementation-summary.md`.
