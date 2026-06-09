# Failure Analysis Policy

For each failed command, report:

- failed command and step
- likely file or test location
- concise error summary and possible cause
- whether responsibility is requirements, implementation, or environment
- one classification
- retry eligibility and reason
- recommended next action

Classifications:

- `implementation_error`
- `test_error`
- `type_error`
- `lint_error`
- `build_error`
- `environment_error`
- `missing_dependency`
- `missing_config`
- `unknown`

When code, test, dependency, package, lockfile, or configuration changes are
needed, write the recommendation to `failure-report.md` and stop.
