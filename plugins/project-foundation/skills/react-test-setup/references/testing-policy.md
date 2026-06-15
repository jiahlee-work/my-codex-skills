# React Testing Policy

- Write focused unit and component tests for behavior affected by the change.
- Prefer `screen.getByRole`, `getByLabelText`, and visible text queries.
- Use `userEvent` for interactions.
- Avoid testing implementation details such as component state names or private
  helper calls.
- Add test utilities only when they remove repeated provider setup.
- Do not introduce snapshot tests as the default baseline.
