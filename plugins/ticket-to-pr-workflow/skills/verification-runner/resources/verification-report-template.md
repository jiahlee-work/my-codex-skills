# Verification Report
## Ticket
{{ticketKey}}
## Verification Mode
{{verificationMode}}
## Summary
{{summary}}
## Commands
| Step | Command | Status | Duration | Log |
|---|---|---:|---:|---|
| lint | {{lintCommand}} | {{lintStatus}} | {{lintDuration}} | {{lintLog}} |
| typecheck | {{typecheckCommand}} | {{typecheckStatus}} | {{typecheckDuration}} | {{typecheckLog}} |
| test | {{testCommand}} | {{testStatus}} | {{testDuration}} | {{testLog}} |
| build | {{buildCommand}} | {{buildStatus}} | {{buildDuration}} | {{buildLog}} |
## Skipped Commands
{{skippedCommands}}
## Failure Analysis
{{failureAnalysis}}
## Retry Summary
{{retrySummary}}
## Result
{{result}}
## Local Verification Boundary
No commit, push, PR, or GitHub Actions check was performed during local verification.
