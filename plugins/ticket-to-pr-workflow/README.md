# Ticket to PR Workflow

티켓의 요구사항을 정리하는 단계부터 구현, 검증, PR 준비까지 이어지는 개발
과정을 Codex App에서 일관되게 수행하도록 설계한 workflow plugin입니다.

Parent skill이 대화 맥락과 작업 상태를 읽고 9개의 child skill을 역할별로
조율합니다. 단순히 다음 코드를 생성하는 것이 아니라 계획의 타당성, 변경
위험, 승인 여부, 검증 결과를 확인한 뒤 다음 행동을 결정합니다.

## 해결하는 문제

티켓 기반 개발에서는 다음 작업이 반복됩니다.

- Jira 티켓과 사용자 설명에서 실제 구현 요구사항을 다시 정리
- 요구사항, 구현 계획, 테스트 시나리오 사이의 누락 확인
- 현재 Git 상태와 변경 범위에 맞는 branch·commit 전략 수립
- 대상 레포에 맞는 검증 명령 선택과 실패 원인 분석
- Storybook과 브라우저에서 확인할 UI 동작 결정
- 변경 내역, 위험 요소, 검증 결과를 반영한 PR 작성

이 plugin은 각 작업을 독립된 Agent 역할로 나누고, 앞 단계의 판단과 결과를
다음 단계의 입력으로 연결합니다.

## 핵심 설계

### 역할별 Agent 조율

Parent skill은 대화 상태, 완료된 작업, 현재 승인 상태를 기준으로 다음 child
skill을 선택합니다. Jira 조회, 계획, 테스트 전략, Git 정책, 코드 변경,
검증, Storybook, 브라우저 시나리오, PR 준비는 각각 전담 skill이 처리합니다.

### 계획 비판

Agent가 작성한 구현 계획을 바로 실행하지 않습니다. 별도의 계획 비판 단계에서
다음을 재평가한 뒤 구현 여부와 필요한 보완 작업을 결정합니다.

- acceptance criteria가 구현 단계와 테스트 시나리오에 연결되는가
- 불명확한 요구사항이나 확인되지 않은 가정이 남아 있는가
- 외부 의존성과 위험 변경에 적절한 검토·검증이 배정됐는가
- branch 전략이 Jira work type이 아니라 실제 변경 성격과 범위에 맞는가

사용자의 구현 의도도 별도로 확인하므로, 티켓에 없는 요구사항을 임의로 만들어
계획을 완성하지 않습니다.

### 승인과 안전장치

Protected branch, 관련 없는 dirty worktree, 티켓 범위 이탈, 민감 파일과
위험 변경을 감지합니다. Dependency 설치, package·lockfile·config 변경,
Storybook 작성, 브라우저 실행, commit, push, PR 생성처럼 상태를 변경하는
작업은 해당 승인 단계가 해결된 경우에만 진행합니다.

티켓의 준비 상태와 불확실성에 따라 `plan-review` 또는 `strict-review`
모드를 권장해 사용자가 검토할 범위를 조절합니다.

### 단계별 검증과 재시도

대상 레포의 package manager와 `package.json` scripts를 우선 사용하고,
변경 범위와 위험도에 따라 경량 또는 전체 검증을 선택합니다. Lint,
typecheck, focused test, full test, build 결과와 실행 시간을 기록합니다.

실패는 먼저 원인을 분류합니다. 일시적인 실패로 판단된 경우에만 최초 실행을
포함해 최대 3회까지 시도하며, 요구사항·Dependency·config·permission 문제는
자동으로 반복하지 않습니다.

### 추적과 재개

계획, 승인 상태, 변경 요약, 위험 분석, 검증 결과는 대상 레포의
`.agent-runs/{ticketKey}-{timestamp}/`에 기록됩니다. 작업이 중단되면 이미
완료된 단계와 해결되지 않은 승인 상태를 확인해 이어서 진행합니다.

## Workflow

Jira MCP intake는 두 가지 트리거를 지원합니다. 기존처럼 assigned ticket을
조회한 뒤 목록에서 선택할 수 있고, `ABC-123` 같은 Jira ticket key를 직접
입력하면 해당 issue detail을 read-only로 조회해 바로 ticket context
단계로 진입합니다.

```text
Jira 또는 직접 전달된 작업 요청
→ 요구사항과 구현 의도 정리
→ 구현 계획 작성
→ 계획 비판
→ 테스트·branch·commit 계획
→ 구현 승인 및 티켓 범위 코드 변경
→ 로컬 검증
→ Storybook·브라우저 검증
→ commit·PR 계획 작성
→ 최종 승인 후 commit·push·PR 실행
```

분석과 계획처럼 안전한 단계는 연속해서 진행합니다. 레포 상태를 변경하거나
외부 작업을 실행하는 지점에서는 멈추고 필요한 승인 또는 추가 정보를
요청합니다.

## Skills

| 구분 | Skill | 역할 |
| --- | --- | --- |
| Parent | `ticket-to-pr-workflow` | 전체 작업 상태, child skill 순서, 승인 단계를 관리 |
| Child | `jira-ticket-context` | Jira 티켓을 read-only로 조회하고 요구사항을 정규화 |
| Child | `task-spec-planner` | 요구사항, 구현 계획, 계획 비판 결과를 작성 |
| Child | `test-plan-worker` | 테스트 환경을 분석하고 테스트 계획 또는 setup 제안을 작성 |
| Child | `branch-commit-policy` | branch·commit 전략을 제안하고 정책을 검증 |
| Child | `ticket-code-worker` | 확인된 branch에서 티켓 범위의 코드와 테스트를 변경 |
| Child | `verification-runner` | 로컬 검증 명령을 선택·실행하고 실패 원인을 분석 |
| Child | `storybook-verifier` | Storybook 환경, component state, story 검증을 관리 |
| Child | `browser-scenario-verifier` | 브라우저 검증 필요성과 시나리오를 판단하고 결과를 기록 |
| Child | `pr-reporting` | commit·PR 계획과 설명을 작성하고 최종 실행 조건을 확인 |

세부 입출력과 책임 범위는 [Skill Suite](docs/skill-suite.md)를 참고하세요.

## MCP와 실행 환경

Jira MCP와 Playwright MCP가 사용자의 Codex `config.toml`에 등록되어 있어야
합니다.

## 실행 범위

- Commit, push, PR 생성은 기본적으로 dry-run이며 최종 승인 전에는 실행하지
  않습니다.
- Production browser target, 실제 결제·이메일, 파괴적 데이터 변경, 계정
  삭제, 권한 변경, secret 접근은 허용하지 않습니다.
- Dependency와 개발 환경 설정은 자동으로 설치하지 않습니다.
- Public marketplace 등록은 현재 범위 밖입니다.

## 문서

- [설치·업데이트·제거](docs/installation.md)
- [Workflow 단계](docs/workflow-stages.md)
- [아키텍처](docs/architecture.md)
- [안전 정책](docs/safety-policy.md)
