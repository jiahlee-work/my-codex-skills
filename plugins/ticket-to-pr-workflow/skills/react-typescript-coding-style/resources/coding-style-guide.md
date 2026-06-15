# Coding Style Guide

이 문서는 React, Next.js, TypeScript 기반 프로젝트에서 일관된 코드 스타일을
유지하기 위한 규칙을 정의한다.

목표는 개인 취향을 강제하는 것이 아니라, 코드 리뷰 비용을 줄이고 컴포넌트의
읽기 흐름을 일정하게 유지하는 것이다.

## 적용 원칙

- 변경한 파일과 직접 맞닿은 코드에 우선 적용한다.
- 티켓 범위 밖의 대규모 스타일 리팩터링은 하지 않는다.
- 프로젝트의 명시적인 lint, formatter, design-system 규칙이 있으면 함께
  따른다.
- 충돌이 있으면 사용자 지시와 프로젝트 규칙을 우선하고, 예외를 보고서에
  기록한다.

## Skill에 맡길 것

- 컴포넌트 내부 선언 순서
- props destructuring 위치
- derived state 금지
- useEffect 사용 기준
- 컴포넌트 분리 기준
- 복잡한 조건식 변수 추출
- 주석 작성 기준
- export 범위 판단

이런 규칙은 맥락 판단이 필요하므로 Codex가 구현과 리뷰 과정에서 적용한다.

## Biome에 맡길 것

- import 정렬
- 중첩 삼항연산자 금지
- block statement 강제
- formatting

이런 규칙은 자동화 가능한 규칙이므로 Biome이 더 잘 처리한다. Codex는 Biome
규칙을 우회하지 말고, 실패하면 touched code를 수정하거나 현재 단계에서
수정이 금지된 경우 보고서에 후속 조치로 남긴다.

## 1. 컴포넌트 내부 선언 순서

컴포넌트 내부 선언은 아래 순서를 따른다.

```tsx
function Component(props) {
  // 1. props destructuring
  // 2. external hooks: router, params, searchParams, context, store
  // 3. local constants / derived ids
  // 4. state hooks
  // 5. derived values: useMemo
  // 6. event handlers: useCallback or normal functions
  // 7. effects
  // 8. early returns
  // 9. render
}
```

예시:

```tsx
function ChatPanel(props: ChatPanelProps) {
  const { chatId, initialMessages } = props

  const router = useRouter()
  const searchParams = useSearchParams()

  const mode = searchParams.get("mode") ?? "default"
  const isReadonly = mode === "readonly"

  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState("")

  const canSubmit = useMemo(() => {
    return input.trim().length > 0 && !isReadonly
  }, [input, isReadonly])

  const handleSubmit = () => {
    // ...
  }

  useEffect(() => {
    // ...
  }, [])

  if (messages.length === 0) {
    return <EmptyMessageState />
  }

  return <MessageList messages={messages} />
}
```

`useId`, `useRouter`, `useParams`, `useSearchParams`, `usePathname`,
`useContext`, store selector는 모두 hook 그룹에 둔다.

```tsx
const generatedId = useId()
```

## 2. Props destructuring 위치

컴포넌트 파라미터에서 바로 구조분해하지 않고, 함수 내부에서 구조분해한다.

권장:

```tsx
function ChatMessageItem(props: ChatMessageItemProps) {
  const { message, isMine, onRetry } = props

  return <div>{message.content}</div>
}
```

지양:

```tsx
function ChatMessageItem({ message, isMine, onRetry }: ChatMessageItemProps) {
  return <div>{message.content}</div>
}
```

이 방식은 props 타입 이름이 잘 보이고, props 전체를 디버깅하거나 전달해야 할
때 유리하다.

단, 매우 단순한 컴포넌트는 예외적으로 파라미터 구조분해를 허용할 수 있다.

```tsx
function IconButton({ icon, label }: IconButtonProps) {
  return <button aria-label={label}>{icon}</button>
}
```

## 3. Boolean 변수 네이밍

boolean 값은 의미가 바로 드러나는 prefix를 사용한다.

권장 prefix:

```tsx
const isLoading = true
const hasMessages = messages.length > 0
const canSubmit = input.trim().length > 0
const shouldShowEmptyState = !isLoading && messages.length === 0
```

지양:

```tsx
const loading = true
const messagesExist = true
const submitAvailable = true
```

권장 기준:

```txt
is-        현재 상태
has-       소유 여부 또는 존재 여부
can-       사용자가 수행 가능한지 여부
should-    UI 또는 로직이 특정 동작을 해야 하는지 여부
```

## 4. Event handler 네이밍

외부에서 주입받는 콜백은 `on-` prefix를 사용하고, 컴포넌트 내부에서 이벤트를
처리하는 함수는 `handle-` prefix를 사용한다.

```tsx
type MessageFormProps = {
  onSubmit: (value: string) => void
}

function MessageForm(props: MessageFormProps) {
  const { onSubmit } = props

  const [input, setInput] = useState("")

  const handleSubmit = () => {
    onSubmit(input)
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

구분:

```txt
onSubmit       외부에서 주입받은 callback
handleSubmit   내부에서 실제 이벤트를 처리하는 함수
```

## 5. Derived state는 state로 관리하지 않는다

props나 state에서 계산할 수 있는 값은 별도 state로 만들지 않는다.

권장:

```tsx
const hasMessages = messages.length > 0
const latestMessage = messages.at(-1)
```

지양:

```tsx
const [hasMessages, setHasMessages] = useState(false)
```

계산 비용이 크거나 참조 안정성이 필요한 경우에만 `useMemo`를 사용한다.

```tsx
const visibleMessages = useMemo(() => {
  return messages.filter((message) => !message.deletedAt)
}, [messages])
```

## 6. useEffect 사용 기준

`useEffect`는 렌더링 결과를 외부 세계와 동기화할 때 사용한다.

적절한 예:

```tsx
useEffect(() => {
  scrollRef.current?.scrollIntoView()
}, [messages])
```

지양:

```tsx
useEffect(() => {
  setFilteredItems(items.filter((item) => item.visible))
}, [items])
```

위 코드는 derived value로 처리한다.

```tsx
const filteredItems = useMemo(() => {
  return items.filter((item) => item.visible)
}, [items])
```

기준:

```txt
- 서버 요청
- DOM 조작
- subscription 등록/해제
- 브라우저 API와의 동기화
- 외부 store 또는 외부 시스템과의 동기화
```

위 경우가 아니라면 먼저 `derived value`, `event handler`, `render logic`으로
해결할 수 있는지 검토한다.

## 7. Early return 위치

early return은 hook 선언 이후, render 직전에 모아둔다.

권장:

```tsx
function ChatPanel(props: ChatPanelProps) {
  const { chatId } = props

  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])

  const hasMessages = messages.length > 0

  if (!chatId) {
    return <InvalidChatState />
  }

  if (!hasMessages) {
    return <EmptyMessageState />
  }

  return <MessageList messages={messages} />
}
```

hook보다 먼저 early return을 두지 않는다.

지양:

```tsx
function ChatPanel(props: ChatPanelProps) {
  const { chatId } = props

  if (!chatId) {
    return <InvalidChatState />
  }

  const [messages, setMessages] = useState<Message[]>([])

  return <MessageList messages={messages} />
}
```

## 8. className 작성 기준

단순한 class는 문자열로 작성한다.

```tsx
<div className="flex items-center gap-2 rounded-md border p-4" />
```

조건부 class가 필요한 경우 `cn()`을 사용한다.

```tsx
<div
  className={cn(
    "flex items-center gap-2 rounded-md border p-4",
    isActive && "bg-muted",
    isDisabled && "pointer-events-none opacity-50",
  )}
/>
```

복잡한 조건부 class를 JSX 안에서 긴 삼항연산자로 작성하지 않는다.

지양:

```tsx
<div
  className={`flex items-center ${
    isActive ? "bg-muted text-primary" : "bg-background text-muted-foreground"
  }`}
/>
```

권장:

```tsx
<div
  className={cn(
    "flex items-center",
    isActive && "bg-muted text-primary",
    !isActive && "bg-background text-muted-foreground",
  )}
/>
```

## 9. 컴포넌트 분리 기준

컴포넌트는 사용 위치가 아니라 복잡도와 책임 기준으로 분리한다.

같은 파일 하단에 둘 수 있는 경우:

```txt
- JSX가 짧고 단순한 presentational component일 때
- 별도 state, effect, 복잡한 handler가 없을 때
- 부모 컴포넌트의 읽기 흐름을 방해하지 않을 때
```

개별 파일로 분리하는 경우:

```txt
- 자체 state, effect, handler를 가진 경우
- JSX가 길거나 조건부 렌더링이 많은 경우
- 특정 UI 영역이 독립적인 책임을 가진 경우
- 테스트 또는 Storybook 작성 대상이 될 수 있는 경우
- 부모 파일을 읽을 때 흐름을 방해하는 경우
```

권장 구조:

```txt
chat-panel/
  chat-panel.tsx
  chat-header.tsx
  chat-message-list.tsx
  chat-input-form.tsx
  empty-message-state.tsx
```

기준은 "한 파일에서만 쓰이는가?"가 아니라 "같은 파일에 있어도 읽기 쉬운가?"이다.

## 10. Import 순서

import 정렬은 수동 리뷰 대상이 아니라 자동화 대상으로 본다.

Biome `organizeImports`를 사용해 import를 자동 정렬한다.

권장 설정:

```json
{
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

권장 scripts:

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

원칙:

```txt
- import 순서는 사람이 직접 맞추지 않는다.
- 저장 시 또는 lint:fix에서 자동 정렬한다.
- 세부 그룹 순서가 필요하면 Biome 설정으로 관리한다.
```

## 11. 타입 선언 위치

컴포넌트 props 타입은 컴포넌트 바로 위에 둔다.

```tsx
type ChatMessageItemProps = {
  message: ChatMessage
  isMine: boolean
  onRetry?: () => void
}

function ChatMessageItem(props: ChatMessageItemProps) {
  const { message, isMine, onRetry } = props

  return <div>{message.content}</div>
}
```

여러 파일에서 공유하는 타입만 별도 파일로 분리한다.

```txt
- 한 컴포넌트에서만 사용하는 props 타입: 같은 파일
- 여러 컴포넌트에서 공유하는 domain type: 별도 파일
- API response/request type: API 또는 domain 기준으로 분리
```

## 12. 파일 내부 export 규칙

한 파일의 주된 컴포넌트만 export한다.

권장:

```tsx
export function ChatPage() {
  return <ChatPanel />
}

function ChatPanel() {
  return <div>...</div>
}

function EmptyMessageState() {
  return <div>메시지가 없습니다.</div>
}
```

지양:

```tsx
export function ChatPage() {
  return <ChatPanel />
}

export function ChatPanel() {
  return <div>...</div>
}

export function EmptyMessageState() {
  return <div>메시지가 없습니다.</div>
}
```

외부에서 직접 사용할 필요가 없는 컴포넌트는 export하지 않는다.

## 13. 복잡한 조건식은 이름 있는 변수로 추출한다

JSX 안에 복잡한 조건식을 직접 작성하지 않는다.

지양:

```tsx
{!isLoading && messages.length === 0 && input.trim().length === 0 && (
  <EmptyMessageState />
)}
```

권장:

```tsx
const shouldShowEmptyState =
  !isLoading && messages.length === 0 && input.trim().length === 0

return (
  <>
    {shouldShowEmptyState && <EmptyMessageState />}
  </>
)
```

조건식이 길어지면 boolean 변수로 추출하고, 변수명은 UI 의도를 드러내도록
작성한다.

## 14. 주석 작성 기준

주석은 "무엇을 하는지"가 아니라 "왜 이렇게 했는지"를 설명한다.

지양:

```tsx
// messages를 필터링한다.
const visibleMessages = messages.filter((message) => !message.deletedAt)
```

권장:

```tsx
// 서버 응답에는 optimistic message가 포함되지 않으므로 클라이언트 메시지를 병합한다.
const visibleMessages = mergeMessages(serverMessages, optimisticMessages)
```

기준:

```txt
- 코드만 봐도 알 수 있는 내용은 주석으로 남기지 않는다.
- 비즈니스 맥락, 우회 처리, 임시 대응, 의도적인 예외만 주석으로 남긴다.
- TODO 주석에는 가능한 경우 이유와 후속 작업 기준을 함께 적는다.
```

## 15. 중첩 삼항연산자 금지

삼항연산자는 한 단계까지만 허용한다.

지양:

```tsx
const sidebarTransform =
  dragDistance === null
    ? undefined
    : isOpen
      ? `translate3d(${dragDistance}px, 0, 0)`
      : `translate3d(calc(-100% + ${dragDistance}px), 0, 0)`
```

권장:

```tsx
const sidebarTransform = getSidebarTransform({
  dragDistance,
  isOpen,
})

function getSidebarTransform(params: {
  dragDistance: number | null
  isOpen: boolean
}) {
  const { dragDistance, isOpen } = params

  if (dragDistance === null) {
    return undefined
  }

  if (isOpen) {
    return `translate3d(${dragDistance}px, 0, 0)`
  }

  return `translate3d(calc(-100% + ${dragDistance}px), 0, 0)`
}
```

짧은 경우에도 중첩 삼항연산자 대신 `if`, 별도 함수, 이름 있는 변수로 분리한다.

Biome 설정:

```json
{
  "linter": {
    "rules": {
      "style": {
        "noNestedTernary": "error"
      }
    }
  }
}
```

## 16. 한 줄 조건문 / 한 줄 block 금지

조건문, 반복문, early return은 한 줄로 작성하지 않는다.

지양:

```tsx
if (isLoading) { return <Loading /> }
```

지양:

```tsx
if (isLoading) return <Loading />
```

권장:

```tsx
if (isLoading) {
  return <Loading />
}
```

본문이 한 줄이어도 block을 사용하고 여러 줄로 작성한다.

Biome 설정:

```json
{
  "linter": {
    "rules": {
      "style": {
        "useBlockStatements": "error"
      }
    }
  }
}
```

## 권장 Biome 설정 예시

```json
{
  "formatter": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "style": {
        "noNestedTernary": "error",
        "useBlockStatements": "error"
      }
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

## 권장 package scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
```

## 최소 적용 항목

초기에는 아래 항목을 우선 적용한다.

```txt
1. 컴포넌트 내부 선언 순서
2. props destructuring 위치
3. boolean 변수 네이밍
4. event handler 네이밍
5. derived state 금지
6. useEffect 사용 기준
7. early return 위치
8. className / cn 사용 기준
9. 컴포넌트 분리 기준
10. import 자동 정렬
15. 중첩 삼항연산자 금지
16. 한 줄 조건문 / 한 줄 block 금지
```
