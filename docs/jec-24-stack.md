# JEC-24 적용 범위

| 순서 | PR                                                            | 변경                                                  |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | [#17](https://github.com/JECT-Study/Ziper-5th-Client/pull/17) | 웹·네이티브 액션 시트, 오류 처리, 웹 버튼 로딩 접근성 |
| 2    | [#18](https://github.com/JECT-Study/Ziper-5th-Client/pull/18) | `@ziper/design-tokens`로 색상·간격·타이포 공유        |

[#19](https://github.com/JECT-Study/Ziper-5th-Client/pull/19)의 `packages/ui` 분리는 보류했다. Button과 시트는 각 앱에, Vanilla Extract 테마는 `ziper-web`에 둔다. 폼·복구 다중 선택과 새 브릿지 RPC는 범위 밖이다. [설계 비교](design-system-jec-24.md)를 참고한다.

- 로컬 검증: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, bridge/web/mobile 타입 검사, `pnpm build:web`.
- 모바일 검증: [액션 시트 재현 절차](../packages/bridge/docs/bridge.md#액션-바텀시트). Metro 번들과 자동 테스트는 실제 앱의 터치·스크롤·스와이프·시스템 Back 검증을 대신하지 않는다.
