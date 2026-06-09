# Repository Development

## Plugin 구성

각 plugin은 `plugins/<plugin-name>/` 아래에 manifest, skills, helper, 사용
문서를 포함합니다. 저장소 수준 테스트는 `tests/`에서 plugin 코드를 직접
검증합니다.

## 개발 검증

```bash
pnpm typecheck
pnpm test
```

## Plugin 검증

변경 후 공식 plugin validator로 manifest와 skill frontmatter를 검증합니다.

```bash
python3 <PLUGIN_CREATOR_ROOT>/scripts/validate_plugin.py \
  plugins/ticket-to-pr-workflow
```

Local marketplace에서 설치 상태를 확인합니다.

```bash
codex plugin add ticket-to-pr-workflow@my-codex-skills
codex plugin list
```

새 Codex thread에서 parent skill이 발견되는지 확인하고, workflow 산출물이
현재 작업 대상 레포에 생성되는지 검증합니다.

## 배포 전 확인

Plugin에 다음 항목을 포함하지 않습니다.

- `.agent-runs`
- `.env` 또는 개인 `config.toml`
- 실제 Jira/GitHub/PR 데이터
- 개인 경로, 이메일, 계정 정보
- token, credential, 인증 header
- 테스트 과정에서 생성된 임시 산출물

Jira MCP와 Playwright MCP의 설치 및 인증 방식은 사용 환경에서 별도로
관리합니다.
