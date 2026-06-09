# Workflow Approval Mode Policy

| Mode | Approval gates |
| --- | --- |
| `plan-review` | Review the plan and stop at Branch Preparation before implementation. |
| `strict-review` | Review the plan, test scenarios, Branch Preparation, implementation, visual gates, and final diff. |

Recommended mode:

| Readiness | Approval Mode |
| --- | --- |
| ready | plan-review |
| needs_clarification | strict-review |
| blocked | strict-review |
| risky | strict-review |

Planning only recommends a mode and generates artifacts. Branch creation or
switching and product/test changes remain separate approval gates.
