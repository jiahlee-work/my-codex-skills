# Browser Scenario Policy

Recommend Browser Verification when any ticket artifact or changed file points
to:

- UI flow, routing, page, component, or style changes
- Form input or submit behavior
- Login, logout, auth, permission, or role-specific UI
- Payment, order, signup, or other user journey changes
- Modal, toast, inline error, or browser interaction changes
- Storybook verification that is skipped or incomplete

Allow `skipped` when changes are limited to:

- Pure utility functions
- Documentation
- Tests only
- Build/config only
- Internal refactors with no UI impact

The scenario plan should include the target area, start URL candidate,
preconditions, needed account/mock state, user inputs, click/input/navigation
steps, expected results, screenshots to capture, non-goals, and execution
readiness.

Browser Scenario Verification scripts record plans and reports only. They do not run MCP, install
Playwright, run project Playwright scripts, or create commits/PRs.
