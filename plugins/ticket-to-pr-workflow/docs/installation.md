# Plugin Installation

## Purpose

This repository provides `ticket-to-pr-workflow` as a Codex plugin that can be
installed from a local or private marketplace. Publishing to the public
marketplace is outside the current scope.

The marketplace manifest is located at `.agents/plugins/marketplace.json`. The
plugin manifest is located at
`plugins/ticket-to-pr-workflow/.codex-plugin/plugin.json`.

## Add the Marketplace Source

Add the root of this repository as a local marketplace source with the Codex
CLI. Replace `<LOCAL_CHECKOUT_PATH>` with the path to your local checkout.

```bash
codex plugin marketplace add <LOCAL_CHECKOUT_PATH>
```

Confirm that the marketplace is registered and the plugin is available.

```bash
codex plugin marketplace list
codex plugin list
```

When using the Codex App plugin browser, add the repository root as a local
marketplace source and select `ticket-to-pr-workflow`.

## Install the Plugin

The marketplace name is `my-codex-skills`.

```bash
codex plugin add ticket-to-pr-workflow@my-codex-skills
```

Open a new Codex App thread after installation so the updated skills are loaded
reliably.

## Verify the Parent Skill

1. Open the target repository in Codex App.
2. In a new thread, select the `ticket-to-pr-workflow` parent skill or ask Codex
   to use it by name.
3. Confirm that the parent skill can select included child skills such as
   `jira-ticket-context`, `task-spec-planner`, and `branch-commit-policy`
   according to the workflow stage.
4. When planning artifacts are created, confirm that
   `.agent-runs/{ticketKey}-{timestamp}/` is written inside the target
   repository rather than the plugin installation directory.

Use `codex plugin list` to confirm that the plugin is available and installed.

## Target Repository Execution

The plugin is not coupled to a specific target repository.

1. Install the plugin from the local or private marketplace.
2. Open the target repository in Codex App.
3. Use the `ticket-to-pr-workflow` parent skill.
4. The parent skill runs the workflow against the target repository's Git
   worktree, `package.json`, test scripts, and Storybook configuration.
5. `.agent-runs/{ticketKey}-{timestamp}/` is created inside the target
   repository.
6. Product and test code changes, branch creation, local verification,
   Storybook and Browser gates, and the PR dry-run all operate against the
   target repository.

Verification commands prefer the target repository's package manager and
`package.json` scripts.

## MCP Configuration Scope

Jira MCP and Playwright MCP are not bundled with the plugin. The required MCP
servers must be registered separately in the user's Codex `config.toml` for the
complete workflow to operate.

- Jira MCP: Jira ticket listing and detail retrieval
- Playwright MCP: agent-mode browser verification during Browser Scenario
  Verification

This documentation does not cover MCP server installation commands, runtime
commands, environment variable names, authentication methods, configuration
examples, or credentials because those details depend on the selected MCP
server implementation and the user's environment.

## Update

Update the marketplace source, then install the plugin again.

```bash
codex plugin add ticket-to-pr-workflow@my-codex-skills
```

Use a new Codex App thread when verifying updated skills.

## Remove

Remove the plugin:

```bash
codex plugin remove ticket-to-pr-workflow@my-codex-skills
```

If the marketplace source is no longer needed, confirm its registered name and
remove it:

```bash
codex plugin marketplace list
codex plugin marketplace remove my-codex-skills
```
