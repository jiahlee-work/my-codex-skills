# my-codex-skills

반복되는 개발 업무를 Codex가 일관된 절차와 안전장치 안에서 수행할 수 있도록
설계한 plugin과 skill을 관리합니다. 각 plugin은 Codex App의 대화형 작업
흐름에 계획, 실행, 검증, 승인 단계를 결합합니다.

## Plugins 목록

### nextjs-app-router

Next.js App Router 프로젝트의 설계, 구현, 검증을 지원하는 skill 모음입니다.
현재 포함된 `nextjs-layered-architecture` skill은 `src/app`을 얇게 유지하고,
제품 코드를 `presentation`, `application`, `infrastructure`의 3개 핵심
Layer로 분리합니다. `shared`는 중립적인 지원 영역으로 두고 TypeScript AST로
역방향 의존을 검사합니다.

- [상세 설명](plugins/nextjs-app-router/README.md)

### ticket-to-pr-workflow

티켓 기반 개발의 맥락 수집부터 PR 준비까지를 parent skill과 9개 child
skill로 나누고, 작업 상태와 승인 조건에 따라 Agent가 다음 역할을 선택하는
Codex App-native workflow입니다.

Jira MCP로 읽은 요구사항과 사용자의 구현 의도를 바탕으로 계획을 작성한 뒤,
Agent가 작성한 계획을 바로 실행하지 않고 별도의 계획 비판 단계에서
acceptance criteria와 구현·테스트의 연결, 불명확한 요구사항, 외부 의존성,
위험 요소를 재평가합니다. Protected branch, dirty worktree, 티켓 범위 이탈을
감지하고 `plan-review`/`strict-review` 승인 모드, 경량/전체 검증,
Storybook·Playwright MCP 승인 단계, 실패 분석과 제한적 재시도를 조합해
자동화와 사용자 통제를 함께 유지합니다. 실행 상태를 기록하므로 중단된 작업도
완료된 단계부터 재개할 수 있습니다.

- [상세 설명](plugins/ticket-to-pr-workflow/README.md)

### project-foundation

여러 레포에 반복 적용할 기본 개발 환경과 운영 안전장치를 repo-local 파일로
저장하도록 돕는 skill 모음입니다. `AGENTS.md`와 engineering docs, Next.js
App Router layered architecture 문서, Biome와 VS Code 설정,
Husky·commitlint·branch guard, GitHub Actions CI, branch protection 가이드,
Vitest + React Testing Library, Storybook, local health check 기준을
제공합니다.

- [상세 설명](plugins/project-foundation/README.md)

## 설치

이 레포의 local checkout을 marketplace source로 등록한 뒤 원하는 plugin을
설치합니다.

```bash
codex plugin marketplace add <LOCAL_CHECKOUT_PATH>
codex plugin add <PLUGIN_NAME>@my-codex-skills
```

설치 후 Codex App에서 작업 대상 레포를 열고 설치한 plugin의 parent skill을
사용합니다.

## 개발 검증

```bash
pnpm typecheck
pnpm test
```

Plugin manifest와 local marketplace 검증 절차는
[`docs/repository-development.md`](docs/repository-development.md)를
참고하세요.

## 범위

- Local/private marketplace 설치를 지원합니다.
- Public marketplace 등록은 현재 범위 밖입니다.
- Plugin별 외부 도구와 설정 전제는 각 plugin 문서에서 안내합니다.
- 개인 설정, 인증 정보, 실제 업무 데이터는 포함하지 않습니다.
