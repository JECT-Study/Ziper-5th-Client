# JEC-24 로컬 PR 스택

아래 `base`로 PR을 만들면 각 PR에 해당 단계의 변경만 표시된다. 위에서 아래 순서로 리뷰·머지한다. 원격 PR은 이 문서에서 만들지 않는다.

| head                   | base                   | 변경                                                                     |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `jec-24`               | `main`                 | 웹·WebView·네이티브 액션 시트 및 오류 처리, Figma 인벤토리               |
| `jec-24-design-tokens` | `jec-24`               | 무단위 디자인 토큰 워크스페이스 추출 및 두 앱에 적용                     |
| `jec-24-ui-primitives` | `jec-24-design-tokens` | 명시적인 웹/네이티브 UI 엔트리와 양쪽 액션 시트에서 소비하는 공통 Button |

하위 PR을 squash merge하면 기존 하위 tip을 기준으로 다음 브랜치의 자체 커밋만 새 base 위에 rebase하고 검증을 재실행한다. 예: 첫 PR이 squash된 뒤 `git rebase --onto origin/main jec-24 jec-24-design-tokens`. 이미 올린 브랜치가 있다면 팀과 히스토리 변경을 조율한다.

- 검증: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, bridge/web/mobile 타입 검사, `pnpm build:web`, iOS/Android Metro export.
- 플랫폼 확인: [브릿지 문서의 재현 절차](../packages/bridge/docs/bridge.md#액션-바텀시트). Metro와 모바일 자동 테스트는 실제 터치·스크롤·스와이프·시스템 Back을 대체하지 않는다.
- 범위: [설계 비교](design-system-jec-24.md). 폼·복구 다중 선택 등의 도메인 동작과 새 RPC는 스택 범위가 아니다.
