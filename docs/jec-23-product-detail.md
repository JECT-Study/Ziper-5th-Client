# JEC-23 상품 상세·상태 관리

## 범위와 실행

- 로그인 후 `/products/<내 상품 ID>`를 열면 상세 조회·수정·활성 보드 선택·원본 이동 기록을 사용할 수 있다. 개발 서버는 `/api` 프록시, 배포 웹은 `https://api.ziper.cc`를 사용한다.
- **구매 완료와 구매 목록은 아래 프리뷰 전용**이다. [JEC-79](https://linear.app/ject5-team6/issue/JEC-79)가 배포되기 전에는 일반 화면에서 해당 동작을 노출하지 않는다.
- 홈·보드에서 상세로의 진입과 목록 갱신(JEC-22), 삭제·복구(JEC-22/27), 신규 이미지 업로드, 재발견 스와이프는 이 연동의 범위 밖이다.

`pnpm dev:web` 후 아래 주소로 확인한다.

| 주소                                    | 상태                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `/products/1?preview=normal`            | 정상 → 수정·구매 완료·결과 목록을 실제 컴포넌트로 조작 |
| `?preview=unavailable`                  | 원본 링크 접근 불가, 저장 정보 유지                    |
| `?preview=purchased`                    | 이미 구매 완료, 중복 구매 액션 없음                    |
| `?preview=empty`                        | 가격·메모·태그 없음, 이미지 로드 실패                  |
| `?preview=offline`, `auth`, `not-found` | 조회 오류                                              |
| `?preview=failed`, `unknown`            | 확정 실패 / 응답 유실에 따른 재확인                    |

프리뷰는 DEV 전용 lazy 모듈의 메모리 데이터다. 새로고침하면 초기화되며 운영 빌드에서는 무시한다.

## 배포 계약

[배포 `0277435`](https://github.com/JECT-Study/Ziper-5th-Server/actions/runs/44993618174) 기준으로 [상품 상세 API](https://github.com/JECT-Study/Ziper-5th-Server/pull/83)와 [보드 조회 API](https://github.com/JECT-Study/Ziper-5th-Server/pull/84)를 사용한다.

- `GET /api/v1/products/{cardId}`, `GET /api/v1/boards`, `PATCH /api/v1/products/{cardId}`, `POST /api/v1/products/{cardId}/open-original`은 기존 Bearer 인증을 사용한다.
- 상세 조회 자체가 이벤트·주기 리셋을 동반하므로 프리로드에서 요청하지 않는다. 화면에서 시작한 읽기는 이탈 시 중단하고, 정상 수정 취소는 기존 상세로 돌아와 다시 읽지 않는다.
- 화면의 ID는 문자열이다. 서버 JSON의 숫자 ID는 안전한 정수인지 검사하고 PATCH의 보드·파일 ID는 숫자로 보낸다. JavaScript 안전 정수 범위 밖의 응답은 거부한다.
- 수정에는 0~10억원 정수 가격, 태그 1개 이상(각 6자 이하), 이미지나 대체 도안, 활성 보드 1개 이상이 필요하다.
- 서명 이미지 URL → 원본 이미지 URL → 대체 도안 순서로 표시한다. PATCH에는 임시 서명 URL을 보내지 않는다. 판매 종료 링크는 원본 열기를 막고 품절 링크는 열 수 있다.
- 응답 유실·5xx·잘못된 성공 응답은 완료 여부를 알 수 없다. [JEC-95](https://linear.app/ject5-team6/issue/JEC-95)처럼 저장이 먼저 반영됐을 수 있으므로 재전송하지 않고 상세를 다시 확인한다.

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
- 수정 화면은 공통 입력 컴포넌트를 사용한다. 메모는 선택이고 상품 URL은 읽기 전용이다.
- 브라우저 메뉴는 Figma 행/아이콘, 앱 메뉴는 기존 네이티브 액션 시트로 OS 취소/Back 동작을 유지한다.

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

- `pnpm test`의 어댑터 테스트는 배포 응답 형태, 인증, 취소, 숫자 ID, 5xx·잘못된 성공 응답을 검증한다. 화면 테스트는 수정·재조회·구매 액션 숨김·이미지 대체를 검증한다.
- `pnpm e2e:ios`, `pnpm e2e:android`는 화면 진입·시트·구매 프리뷰·Back 회귀다. 서버에 데이터를 쓰지 않는다.
- 연동 확인: 전용 테스트 계정으로 로그인한 뒤 프리뷰 없이 자기 카드를 열고, 메모를 수정한 뒤 다시 열어 반영을 확인한다. 원본 이동 성공 후에만 이벤트를 전송하는지 확인하고, 테스트 카드에서만 실행한다.
