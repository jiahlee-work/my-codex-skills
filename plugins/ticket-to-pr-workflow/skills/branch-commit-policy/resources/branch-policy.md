# Branch Policy

Branch format:

```text
{type}/{ticketKey}-{slug}
```

Examples:

```text
feature/FE-123-login-error-message
fix/FE-124-button-disabled-state
chore/FE-125-update-test-fixtures
```

Choose branch type from the ticket content and expected code change:

- `feature`: new user-visible behavior or capability
- `fix`: defect, failure, regression, or incorrect behavior
- `chore`: maintenance, configuration, tooling, dependency, or fixture work

Do not derive branch type directly from Jira work type.

Validation rules:

- Must match `{type}/{ticketKey}-{slug}`.
- Slug must be kebab-case.
- Slug length must be 48 characters or less.
- `main`, `master`, and `develop` are rejected.
