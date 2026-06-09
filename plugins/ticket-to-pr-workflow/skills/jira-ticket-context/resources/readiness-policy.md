# Readiness Policy

Classify in this order:

1. `blocked` when explicit blockers exist.
2. `risky` for security, permissions, authentication, payment, deletion, or
   other risk-sensitive areas.
3. `needs_clarification` when Acceptance Criteria are missing or requirements
   are unclear.
4. `ready` when requirements are sufficient for planning.

| Readiness | Recommended Approval | Recommended Verification |
| --- | --- | --- |
| ready | plan-review | light |
| needs_clarification | strict-review | full |
| blocked | strict-review | full |
| risky | strict-review | full |

Light verification drafts lint, typecheck, and tests. Full verification also
drafts build and end-to-end checks when available in the target repository.
