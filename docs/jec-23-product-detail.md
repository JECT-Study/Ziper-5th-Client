# JEC-23 상품 상세·상태 관리 레퍼런스

## 범위와 실행

- 상세 조회, 전체 상품명·가격·이미지·메모·태그·소속 보드 표시.
- 상품 수정, 계절/직접 입력 태그, 기존 이미지 유지·제거·대체 도안, 활성 보드 선택.
- 구매 완료 확인 → 서버 성공 후 상태 및 구매 완료 목록 갱신.
- 원본 쇼핑몰 열기와 방문 기록은 구매 완료와 별개.
- **제외:** JEC-22 홈/보드 관리·상품 삭제, JEC-27 휴지통·복구. 다른 화면의 목록·카운트 갱신도 해당 기능 통합 시 연결한다. 신규 이미지 업로드, 구매 취소, 재발견 스와이프/Undo는 추가하지 않는다.

`pnpm dev:web` 후 아래 주소로 확인한다.

| 주소                                    | 상태                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `/products/1?preview=normal`            | 정상 → 수정·구매 완료·결과 목록을 실제 컴포넌트로 조작 |
| `?preview=unavailable`                  | 원본 링크 접근 불가, 저장 정보 유지                    |
| `?preview=purchased`                    | 이미 구매 완료, 중복 구매 액션 없음                    |
| `?preview=empty`                        | 가격·메모·태그 없음, 이미지 로드 실패                  |
| `?preview=offline`, `auth`, `not-found` | 조회 오류                                              |
| `?preview=failed`, `unknown`            | 확정 실패 / 응답 유실에 따른 재확인                    |

프리뷰는 DEV 전용 lazy 모듈이며 인스턴스별 메모리 데이터다. 새로고침하면 초기화된다. 운영 빌드에서는 프리뷰 파라미터와 fixture를 제거하고 **서비스 미연결**을 표시한다. 가짜 HTTP 요청이나 운영 성공 응답은 만들지 않는다.

## 서버 조사와 타입 근거

조사 기준: [Server develop @ 6e3b7dc](https://github.com/JECT-Study/Ziper-5th-Server/tree/6e3b7dcd8a5c565f4b3cd8de2430cadd7b91f270). GitHub API로 전체 파일 트리, 열린 PR 7개 및 최근 병합 PR을 확인했다. 열린 PR #32, #33, #52–56은 모두 의존성 업데이트이며, 상품 상세/수정/구매 HTTP Controller·DTO는 없다. DeepWiki에는 이 저장소가 인덱싱되어 있지 않아 원본 코드·문서로 조사했다.

| 원본                                                                                                                                                                               | 참고한 내용                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [V6 migration](https://github.com/JECT-Study/Ziper-5th-Server/blob/6e3b7dcd8a5c565f4b3cd8de2430cadd7b91f270/src/main/resources/db/migration/V6__create_product_and_tag_tables.sql) | `PLANNED / PURCHASED`, nullable 가격·이미지, 대체 도안 5종, 상품당 다중 태그/보드 |
| [ADR 0015](https://github.com/JECT-Study/Ziper-5th-Server/blob/6e3b7dcd8a5c565f4b3cd8de2430cadd7b91f270/docs/adr/0015-product-card-and-rediscovery-schema.md)                      | 동일 URL 단일 카드, 구매 완료 시 보드 연결 보존, 도메인 API는 후속                |
| [PRD](https://github.com/JECT-Study/Ziper-5th-Server/blob/6e3b7dcd8a5c565f4b3cd8de2430cadd7b91f270/docs/prd.md)                                                                    | 상세/원본 이동 시 14일 리셋, 구매 완료는 모든 일반 보드·재발견에서 제외           |
| [ProblemFactory](https://github.com/JECT-Study/Ziper-5th-Server/blob/6e3b7dcd8a5c565f4b3cd8de2430cadd7b91f270/src/main/java/com/ject/ziper/global/error/ProblemFactory.java)       | `application/problem+json`, `code`, `requestId`, 401 Bearer                       |
| [JEC-77](https://linear.app/ject5-team6/issue/JEC-77), [JEC-79](https://linear.app/ject5-team6/issue/JEC-79)                                                                       | 예정 상세/수정/원본 이벤트 및 구매 완료 API — 구현된 HTTP 계약이 아님             |

`@ziper/api/product-detail`은 **클라이언트용 인터페이스**다. DB 스키마를 서버 DTO로 간주하거나 예정 경로에 임의로 요청하지 않는다.

- BIGINT ID는 클라이언트에서 문자열로 취급한다. 최종 JSON ID 표현은 서버와 협의한다.
- 가격은 nullable 원 단위 정수. 기존 등록 폼과 같은 10자리 입력 제한/파서를 재사용한다.
- 상품명은 예정 API의 보수적인 200자 제한(V6 컬럼은 255자), 메모는 100자, 태그는 개별 64자.
- 삭제 상태를 status enum에 넣지 않는다. 서버의 소프트 삭제와 구매 상태는 별개다.
- 최종 HTTP 어댑터에서 응답 검증·null 정규화·인증·오류 코드 매핑·가격 범위·업로드·구매 목록 정렬/페이지네이션을 확정해야 한다.
- 쓰기 실패가 확정된 경우만 재시도를 허용한다. 응답 유실은 자동 재전송하지 않고 상세 재조회로 확인하도록 안내한다.

상세 조회 자체가 이벤트/주기 리셋을 동반하므로 **라우트 preload에서 호출하지 않는다.** 화면의 실제 진입에서 조회하고, 이탈한 조회는 abort 및 늦은 응답 검사로 버린다. 백엔드 연동 시 조회 이벤트 중복/멱등성 정책도 검증한다.

## Figma와 구현 경계

MCP 요청을 병렬화하지 않고 순차 조회했다. 다음 노드의 디자인 컨텍스트와 스크린샷을 확인했다.

- [Flow 5 전체 561:5912](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-5912)
- [상세 561:5925](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-5925)
- [구매 확인 561:6065](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-6065)
- [구매 결과 561:6081](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-6081)
- [수동 수정 561:4365](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-4365)

현재 상품 상세는 Flow 5의 PRD2 레퍼런스 화면을 기준으로 한다. 해당 프레임의 green/Noto Sans KR는 기존 공통 lime/Pretendard와 달라 기능 스타일로 한정했다. 원본 SVG는 로컬 에셋으로 저장했고 임시 Figma URL에 런타임 의존하지 않는다. Button/HeaderSub/TextField/ChipFilter/BottomSheet/Dialog/Toast는 기존 컴포넌트를 조합한다.

의도적인 차이:

- 삭제 메뉴·휴지통 안내와 하단 보드 탐색은 JEC-22/27 범위라 노출하지 않는다.
- 수정 화면은 공통 입력 컴포넌트를 사용하며 스크롤과 검증을 유지한다. 이전 C6의 “메모/태그 필수” 문구는 최신 서버 PRD와 충돌하므로 강제하지 않는다. 상품 URL 변경 API가 없어 읽기 전용이다.
- 브라우저 메뉴는 Figma 행/아이콘, 앱 메뉴는 기존 네이티브 액션 시트로 OS 취소/Back 동작을 유지한다.
- 구매 결과의 보드명 고정 문구는 서버의 `affectedBoardCount`를 사용한다. 구매 완료 상태만 바꾸며 보드 연결을 프런트에서 삭제하지 않는다.

## 외부 이동

`external.open.v1 / externalOpenV1`을 협상한다. 웹과 네이티브 양쪽에서 HTTP(S)·userinfo/제어문자 등을 검사하고, 네이티브는 현재 활성 문서에서만 `Linking.openURL`을 호출한다. 기존 외부 문서·팝업 차단 정책을 완화하지 않는다. 동일 operation ID는 기존 ledger로 중복 방지한다.

브라우저에서는 클릭 스택에서 창을 열고 opener를 제거한 뒤 이동한다. 앱의 미지원·오류·응답 유실에는 웹 fallback을 실행하지 않는다. 외부 열기 성공 후 원본 이벤트를 기록하며, 이벤트 실패와 열기 실패/결과 불명을 구분한다.

## 사용한 공식 문서

- [React useEffect 데이터 조회·정리](https://react.dev/reference/react/useEffect#fetching-data-with-effects): 이탈/늦은 응답 처리.
- [TanStack Router 파일 규칙](https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions): `products.$cardId.tsx` 경로와 파라미터.
- [Vanilla Extract 스타일링](https://vanilla-extract.style/documentation/styling/): 기능 범위의 스타일·선택자, 기존 컴포넌트 조합.
- [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [React Native Linking](https://reactnative.dev/docs/linking#openurl): 헤더 중복 제거와 OS 브라우저 Promise/실패 처리.
- [Vitest mocking](https://vitest.dev/guide/mocking.html): transport/OS 경계만 대역으로 검증, cleanup.
- Figma MCP의 공식 `figma-design-to-code` 리소스와 agent-browser 내장 가이드를 읽고 조회·스크린샷·접근성 검사를 진행했다. PR 첨부는 `gh attach --help`의 `--repo / --markdown` 사용법을 따랐다.

## 검증

- `pnpm test`: 웹 UI, 실제 브릿지 transport, 모바일 handler 및 Expo Router iOS/Android 테스트.
- `pnpm typecheck:bridge`, `typecheck:web`, `typecheck:mobile`, `typecheck:landing`.
- `pnpm lint`, `pnpm fmt`, `pnpm check`, `pnpm build:web`, `git diff --check`.
- 브라우저 375×812에서 정상/접근불가/메뉴/확인/구매 완료/수정을 Figma와 반복 비교. 320px에서 수평 넘침 없음.
- 브라우저에서 수정 저장, 구매 완료, 결과 불명 시 중복 액션 차단 확인.
- axe-core로 상세·접근불가·구매 완료·수정 검사. 수정 도움말의 대비 문제를 이 화면에 한정해 수정.
- 운영 SSR 서버에서 `?preview=normal`이 제거되고 서비스 미연결 상태만 나오는지, fixture가 클라이언트 번들에 없는지 확인.

실제 서버 통합, 실제 기기/시뮬레이터에서의 OS 브라우저 전환·키보드·Back 동작 검증은 수행하지 않았다. 모바일 자동 테스트의 WebView/OS 서비스는 mock이며 단말 검증을 대신하지 않는다.
