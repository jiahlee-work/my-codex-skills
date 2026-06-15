# AGENTS Composition Policy

`AGENTS.md` must contain prescriptive working rules, not descriptive summaries
of the repository's current state.

Use repository inspection only to decide which baseline snippets apply, detect
conflicts, and plan approved setup. Do not use inspection to generate durable
sections that describe the current app, files, commands, environment variables,
UI implementation, APIs, streaming behavior, vendors, or generated artifacts.

## Allowed Content

Allowed sections tell agents how to work from now on:

- source of truth and migration stance
- architecture rules
- coding style rules
- testing rules
- verification rules
- Git workflow rules
- dependency and tooling rules
- Storybook rules

These sections must stay generic unless the user explicitly approves a
repo-specific rule.

## Disallowed Generated Content

Do not generate these sections from repository inspection:

- `Project Overview`
- `Core Commands`
- `Repository Structure`
- `Environment`
- `UI Guidelines`
- `API Guidelines`
- `API And Streaming Guidelines`
- route-by-route, file-by-file, or script-by-script inventories
- framework, vendor, SDK, model, service, or environment summaries inferred from
  the current code

Do not write statements such as "this app uses...", "the app serves...",
"currently...", or "the repository contains..." unless the user explicitly
provides and approves that wording.

## Legacy And Migration Stance

Existing code may be legacy, inconsistent, or awaiting migration. Do not
formalize the existing layout as the target architecture. Preserve behavior
while moving new or touched code toward the documented rules.
