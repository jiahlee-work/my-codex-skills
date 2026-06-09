# Storybook Environment Policy

Inspect `package.json`, `.storybook/main.*`, `.storybook/preview.*`,
`src/**/*.stories.*`, `src/**/*.mdx`, `stories/**/*.stories.*`, and
`stories/**/*.mdx`.

Detect `storybook`, `@storybook/*`, Storybook scripts, the package manager,
configuration files, story conventions, decorators, providers, and these
commands:

- `pnpm storybook`
- `pnpm build-storybook`
- `pnpm storybook:build`
- `pnpm test-storybook`
- `pnpm chromatic`

Report an absent setup as `not-configured`; absence is not a command failure.
Treat partial dependency, script, or config signals as `partial` and require
setup approval before changing repository setup.
