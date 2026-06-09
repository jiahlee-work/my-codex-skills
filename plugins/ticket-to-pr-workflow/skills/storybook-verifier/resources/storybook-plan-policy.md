# Storybook Plan Policy

Build the plan from changed files, diff and implementation summaries, task
spec, user intent, and existing stories.

Include:

- changed UI components
- existing story matches
- story files to add or update
- required component states
- mock props, decorators, and providers
- available Storybook checks
- explicit non-goals

Prioritize default, loading, error, empty, disabled, success, permission
denied, and relevant mobile or responsive states. Follow existing naming,
location, framework, decorator, and provider conventions.

Required output shape:

```markdown
# Storybook Plan
## Ticket
{{ticketKey}}
## Changed UI Components
{{changedUiComponents}}
## Existing Stories
{{existingStories}}
## Stories To Add or Update
{{storiesToAddOrUpdate}}
## Component States
{{componentStates}}
## Required Mocks or Providers
{{requiredMocksOrProviders}}
## Suggested Storybook Commands
{{suggestedCommands}}
## Non-goals
{{nonGoals}}
```
