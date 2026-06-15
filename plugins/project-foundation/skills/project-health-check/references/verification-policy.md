# Verification Policy

Run repository checks after setup or implementation changes. Prefer the
repository's existing package scripts and skip checks that are not configured.

## Check Order

Run available checks in this order:

```text
lint -> typecheck -> test -> build
```

Run `build-storybook` when Storybook setup, configuration, or story files
changed.

## Modes

- Light: `lint`, `typecheck`, and `test`
- Full: `lint`, `typecheck`, `test`, `build`, and `build-storybook` when
  configured

Use full mode for package, lockfile, config, Storybook, test setup, GitHub
Actions, auth, routing, build, or framework changes.

## Failure Handling

Stop after the first failing command unless the user asks to continue. Report:

- the command
- the exit code
- the likely cause
- the recommended next fix

Do not change source, tests, dependencies, package files, lockfiles, or
configuration during a verification-only pass.
