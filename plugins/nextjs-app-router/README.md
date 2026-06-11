# Next.js App Router

Next.js App Router 프로젝트를 설계, 구현, 점검하는 Codex skill 모음입니다.

이 plugin은 특정 아키텍처 하나를 plugin 전체의 규칙으로 고정하지 않습니다.
App Router와 관련된 독립적인 기능을 하위 skill로 추가할 수 있으며, 각 skill은
자신의 목적과 설계 계약을 해당 `SKILL.md`에서 정의합니다.

## Skills

### nextjs-layered-architecture

제품 코드를 Presentation, Application, Infrastructure의 3개 핵심 Layer로
분리합니다. `src/app`은 얇은 라우팅 경계로, `src/shared`는 중립적인 공통
영역으로 유지합니다.

```text
src/
  app/              # Next.js boundary
  presentation/     # core layer
  application/      # core layer
  infrastructure/   # core layer
  shared/           # supporting area
```

주요 기능:

- Layer 구조와 권장 하위 폴더 생성
- `@/*` alias 설정
- 코드의 변경 이유에 따른 파일 위치 판단
- `src/app` 내부의 비라우팅 코드 탐지
- TypeScript AST 기반 역방향 import 검사
- 기존 프로젝트의 단계적 구조 migration 안내

설계 배경, 각 Layer의 특징, 의존 규칙과 구조적 이점은
[`skills/nextjs-layered-architecture/SKILL.md`](skills/nextjs-layered-architecture/SKILL.md)를
참고합니다.

호출:

```text
Use $nextjs-app-router:nextjs-layered-architecture to structure this Next.js App Router project.
```

직접 실행:

```bash
plugins/nextjs-app-router/skills/nextjs-layered-architecture/scripts/nextjs-layered-architecture.sh \
  setup --project <NEXTJS_PROJECT_ROOT> --dry-run

plugins/nextjs-app-router/skills/nextjs-layered-architecture/scripts/nextjs-layered-architecture.sh \
  audit --project <NEXTJS_PROJECT_ROOT>
```
