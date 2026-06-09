# Playwright MCP Agent-Mode Policy

Playwright MCP is used only when it is available in the Codex agent runtime.
Local TypeScript scripts do not call MCP and do not implement an MCP client.

Agent-mode procedure:

1. Read `browser-scenario-plan.md`.
2. Confirm the target is localhost, 127.0.0.1, local preview, or explicitly
   approved staging.
3. Refuse production, real payment/email, destructive data, account deletion,
   permission changes, real user data changes, or secret reads.
4. If Playwright MCP is available, open the browser and perform the planned
   scenario directly.
5. Record observations through
   `generate-browser-verification-report.ts --status passed|failed --mcp-notes "<summary>"`.
6. If MCP is unavailable, record `skipped` or `approval-required`.

Out of scope for this phase:

- Local MCP client implementation
- MCP result merge scripts
- Playwright installation automation
- Project Playwright fallback runners
- Browser artifact collection automation
