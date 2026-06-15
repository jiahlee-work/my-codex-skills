## Verification

- Follow `docs/engineering/verification.md`.
- After implementation changes, run available checks in this order: lint,
  typecheck, test, build.
- Run Storybook build when Storybook setup, configuration, or stories change.
- Skip missing commands instead of inventing new scripts during verification.
- Stop after the first failing verification command, report the failure, and do
  not auto-fix unless the user asks for a follow-up implementation pass.
