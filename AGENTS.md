# Agent Instructions

This repository contains Codex plugins and their supporting skills.

## Repository Layout

- Plugin implementations live under `plugins/<plugin-name>/`.
- Plugin documentation belongs with the plugin.
- Repository-level tests live under `tests/` and exercise plugin code directly.
- Repository maintenance documentation lives under `docs/`.

## Runtime Boundary

- Run plugin workflows against the repository currently open in Codex.
- Write `.agent-runs/{ticketKey}-{timestamp}/` to that target repository.
- Do not package runtime artifacts, personal Codex configuration, credentials,
  real Jira data, real GitHub data, or personal paths.

## ticket-to-pr-workflow

- Preserve the parent/child skill orchestration and documented approval gates.
- Keep Jira access read-only.
- Require the documented approvals for branch changes, product/test edits,
  dependency or setup changes, Storybook writes, browser actions, commit, push,
  and PR creation.
- Keep Jira MCP and Playwright MCP configuration external to the plugin.

## Verification

- Run `pnpm typecheck` and `pnpm test` after TypeScript changes.
- Validate changed plugin manifests with the official plugin validator.
- Reinstall updated plugins and verify discovery from a fresh Codex session.
- Scan plugin contents for credentials, real service URLs, personal paths, and
  runtime artifacts before completion.
