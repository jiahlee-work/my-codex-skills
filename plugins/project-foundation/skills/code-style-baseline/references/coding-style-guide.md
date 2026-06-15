# Coding Style Guide

This guide keeps React, Next.js, and TypeScript code consistent while avoiding
large preference-driven rewrites. Apply it to changed files and directly related
code, not to unrelated areas.

## 1. Component Declaration Order

Use this order inside components:

```tsx
function Component(props: ComponentProps) {
  // 1. props destructuring
  // 2. external hooks: router, params, searchParams, context, store
  // 3. local constants / derived ids
  // 4. state hooks
  // 5. derived values: useMemo when needed
  // 6. event handlers
  // 7. effects
  // 8. early returns
  // 9. render
}
```

Keep `useId`, `useRouter`, `useParams`, `useSearchParams`, `usePathname`,
`useContext`, and store selectors in the hook group.

## 2. Props Destructuring

Prefer destructuring component props inside the function:

```tsx
function ChatMessageItem(props: ChatMessageItemProps) {
  const { message, isMine, onRetry } = props;

  return <div>{message.content}</div>;
}
```

Allow parameter destructuring only for intentionally trivial components.

## 3. Boolean Names

Use meaning-bearing boolean prefixes:

```tsx
const isLoading = true;
const hasMessages = messages.length > 0;
const canSubmit = input.trim().length > 0;
const shouldShowEmptyState = !isLoading && messages.length === 0;
```

Use `is` for state, `has` for existence or ownership, `can` for capability, and
`should` for UI or logic decisions.

## 4. Event Handler Names

Use `on*` for callbacks provided by a parent and `handle*` for internal handlers.

```tsx
type MessageFormProps = {
  onSubmit: (value: string) => void;
};

function MessageForm(props: MessageFormProps) {
  const { onSubmit } = props;

  const [input, setInput] = useState("");

  const handleSubmit = () => {
    onSubmit(input);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## 5. Derived State

Do not store values in state when they can be derived from props or state.

```tsx
const hasMessages = messages.length > 0;
const latestMessage = messages.at(-1);
```

Use `useMemo` only when computation is expensive or referential stability matters.

## 6. Effects

Use `useEffect` to synchronize rendering with external systems:

- server requests
- DOM manipulation
- subscriptions
- browser APIs
- external stores or systems

Do not use effects to compute render-only derived values.

## 7. Early Returns

Place early returns after hook declarations and before the final render.

```tsx
function ChatPanel(props: ChatPanelProps) {
  const { chatId } = props;

  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);

  const hasMessages = messages.length > 0;

  if (!chatId) {
    return <InvalidChatState />;
  }

  if (!hasMessages) {
    return <EmptyMessageState />;
  }

  return <MessageList messages={messages} />;
}
```

Do not put early returns before hooks.

## 8. className

Use plain strings for simple classes.

```tsx
<div className="flex items-center gap-2 rounded-md border p-4" />
```

Use `cn()` for conditional classes.

```tsx
<div
  className={cn(
    "flex items-center gap-2 rounded-md border p-4",
    isActive && "bg-muted",
    isDisabled && "pointer-events-none opacity-50",
  )}
/>
```

Avoid long conditional template literals in JSX.

## 9. Component Splitting

Split components by responsibility and readability, not only by reuse.

Keep a subcomponent in the same file when it is short, presentational, has no
state/effects/complex handlers, and does not interrupt the parent flow.

Move it to a separate file when it owns state, effects, handlers, complex
conditions, a distinct UI responsibility, tests, or Storybook stories.

## 10. Imports

Do not manually review import ordering. Use Biome `organizeImports`.

## 11. Type Placement

Place component props types directly above the component. Move only shared
domain, API, or cross-component types to separate files.

## 12. Exports

Export only the primary component from a file unless another module needs a
secondary component directly.

## 13. Complex Conditions

Extract complex JSX conditions to named booleans.

```tsx
const shouldShowEmptyState =
  !isLoading && messages.length === 0 && input.trim().length === 0;

return <>{shouldShowEmptyState && <EmptyMessageState />}</>;
```

## 14. Comments

Comment why code exists, not what obvious code does. Use comments for business
context, intentional exceptions, temporary workarounds, and TODOs with a reason
or follow-up condition.

## 15. Nested Ternaries

Do not use nested ternaries. Extract to named variables, `if` statements, or
helper functions. Biome enforces this.

## 16. One-Line Blocks

Do not write one-line control-flow blocks or blockless `if` statements. Biome
enforces block statements.
