# JEC-23 상품 상세·상태 관리

디자인·백엔드 조사와 후속 작업은 [JEC-23 구현 계획](jec-23-implementation-plan.md)을 참고한다.

## 범위와 실행

- 로그인 후 `/products/<내 상품 ID>`를 열면 상세 조회·수정·활성 보드 선택·원본 이동 기록을 사용할 수 있다. 개발 서버는 `/api` 프록시, 배포 웹은 `https://api.ziper.cc`를 사용한다.
- **구매 완료·구매 완료 목록은 개발 모드의 로컬 fixture에서만 활성화된다.** [JEC-79](https://linear.app/ject5-team6/issue/JEC-79)의 실제 응답을 확인하기 전에는 배포 앱에서 관련 API를 호출하지 않는다.
- 보드 상세에서 상품을 열면 같은 WebView 안에서 이동한다. 뒤로 가면 보드가 다시 조회되어 수정·구매 결과가 반영된다. 구매 목록에서 연 상세의 ‘구매 완료 목록 보기’는 기존 목록으로 돌아가며 정렬을 유지한다.
- 범위 밖: 보드별 상품 제거·휴지통 이동과 보드 화면 관리([JEC-22](https://linear.app/ject5-team6/issue/JEC-22)), 휴지통 복구(JEC-27), 재발견 스와이프(JEC-21).

`pnpm dev:web` 후 아래 주소로 확인한다.

| 주소                                    | 상태                                         |
| --------------------------------------- | -------------------------------------------- |
| `/products/1?preview=normal`            | 정상 → 수정·구매 완료를 실제 컴포넌트로 조작 |
| `?preview=unavailable`                  | 원본 링크 접근 불가, 저장 정보 유지          |
| `?preview=purchased`                    | 이미 구매 완료, 중복 구매 없음               |
| `?preview=empty`                        | 가격·메모·태그 없음, 이미지 로드 실패        |
| `?preview=offline`, `auth`, `not-found` | 조회 오류                                    |
| `?preview=failed`, `unknown`            | 확정 실패 / 응답 유실에 따른 재확인          |

프리뷰는 DEV 전용 lazy 모듈의 메모리 데이터다. 새로고침하면 초기화되며 운영 빌드에서는 무시한다. 프리뷰에는 구매 목록 화면이 없으므로, 구매 완료 후 목록 이동은 아래 fixture로 확인한다.

### 로컬 HTTP 통합 검증

`node --test e2e/jec23/mock-api.test.mjs`는 별도 루프백 포트에서 fixture를 띄워 구매 후 보드 매핑 보존·4종 정렬·커서·재발견 제외, 상세 조회·원본 이동의 14일 연기와 구매 목록 날짜순 변화를 검증한다. `/_state?at=<ISO-8601>`는 fixture 전용 진단이며 앱은 호출하지 않는다.

```sh
# 터미널 1: 메모리 fixture, 로컬 루프백만 수신
node e2e/jec23/mock-api.mjs
# 터미널 2: 이 dev 서버의 모든 API 요청을 fixture로 보낸다 (운영 fallback 없음).
VITE_JEC23_MOCK=1 NO_HMR=1 pnpm dev:web
# 터미널 3: 각 앱 테스트 전 초기화. 상태를 공유하므로 두 플랫폼은 순차 실행.
curl -fsS -X POST http://127.0.0.1:3011/_reset
pnpm e2e:ios e2e/jec23/edit-board-membership.yaml
curl -fsS -X POST http://127.0.0.1:3011/_reset
pnpm e2e:android e2e/jec23/edit-board-membership.yaml
```

각 시나리오 첫 줄 주석에 필요한 `/_reset` 쿼리가 적혀 있다. `e2e/jec23/` 시나리오는 실행 전에 웹 프록시를 거쳐 fixture 응답을 확인한다. 웹 서버나 fixture가 없거나 일반 개발 서버를 띄웠다면 앱을 실행하지 않는다. 검사를 통과하면 기존 8081 대신 전용 Metro를 8082에서 실행한다. WebView 주소는 iOS `http://127.0.0.1:3000`, Android `http://10.0.2.2:3000`으로 고정한다.

브라우저에서는 `http://127.0.0.1:3000/boards` → 기본 보드 → 상품 상세로 들어간다. 구매 완료 후 `/products/purchased`의 2열 목록·정렬·다음 페이지를 확인한다. 구매 목록은 보드 탭의 구매 완료 카드나 주소로도 진입할 수 있다.

기본 fixture는 자동 로그인용이다. 이메일 로그인부터 확인하려면 `curl -fsS -X POST 'http://127.0.0.1:3011/_reset?auth=email'`로 초기화한 뒤 `http://127.0.0.1:3000/login/email`에서 **`jec23@example.test` / `Jec23Fixture!`**로 로그인한다. 이 값은 로컬 전용 가상 계정이다. 브라우저와 앱은 기존 로그인 코드를 사용하고, fixture만 로그인·HttpOnly 쿠키 재발급·로그아웃에 응답한다. 가입·소셜 로그인 및 운영 토큰 검증은 이 대역의 범위가 아니다.

fixture의 `/_reset`에 아래 쿼리를 붙여 `POST`하면 장애를 재현할 수 있다. 정상 흐름으로 돌아가려면 파라미터 없이 초기화한다.

| 쿼리                                             | 검증                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purchasedPageReissue=401`                       | 구매 목록의 다음 페이지와 세션 재발급에 401 응답. `e2e/jec23/purchased-session-expiry.yaml` 실행.                                                                               |
| `purchasedPageReissue=403` 또는 `503`            | 다음 페이지가 401이고 세션 재발급만 한 번 실패한다. `e2e/jec23/purchased-reissue-retry.yaml`에서 기존 카드와 커서가 유지되는지 확인.                                            |
| `failReissueOnce=1` 또는 `403`                   | 첫 세션 확인이 한 번만 503 또는 403. 새 브라우저에서 구매 목록을 직접 열고 ‘목록 다시 불러오기’를 누른다.                                                                       |
| `expiredSession=1`                               | 상세·세션 재발급에 401 응답. 상품 주소를 직접 열고 로그인 이동을 확인한다.                                                                                                      |
| `expireSessionOnEdit=1`                          | 첫 PATCH 직전 세션 만료. `e2e/jec23/edit-session-expiry.yaml`에서 저장 차단과 로그인 이동을 검증한다.                                                                           |
| `expireSessionOnPurchase=1`                      | 첫 구매 확정 직전 세션 만료. `purchase-session-expiry.yaml`에서 로그인 이동을, `auth=email`을 함께 설정한 `email-purchase-expiry.yaml`에서 재로그인과 명시적 재시도를 검증한다. |
| `removedBeforePurchase=1`                        | 구매 확정 직전 상품이 삭제되고 POST는 400을 반환한다. `e2e/jec23/purchase-stale-card.yaml` 실행.                                                                                |
| `duplicateBoardOnCreate=1`                       | 보드 선택 조회 이후 같은 이름의 보드가 다른 기기에서 생성되고, 첫 생성 요청은 409. `e2e/jec23/edit-board-name-conflict.yaml` 실행.                                              |
| `deleteBoardOnEdit=1`                            | 첫 PATCH 직전 가을 코디 보드를 제거. `e2e/jec23/edit-stale-board.yaml` 실행.                                                                                                    |
| `removeCardOnEdit=1`                             | 첫 PATCH 직전 상품이 다른 곳에서 삭제된다. 보드 진입은 `edit-removed-product.yaml`, 구매 목록 진입은 `purchased-edit-removed.yaml`을 실행한다.                                  |
| `originalVisitStatus=401` 또는 `404`             | 원본 방문 기록 시 세션이 만료되거나 상품이 사라진 상태를 재현한다. 상세·구매 목록에서 확인한다.                                                                                 |
| `delayOriginalReply=1`                           | 원본 방문 기록 응답을 6초 지연하고 린넨 블라우스의 링크를 판매 종료로 표시한다.                                                                                                 |
| `staleEditReply=1`                               | 저장은 반영하지만 첫 PATCH 200에 수정 전 값을 반환한다. `e2e/jec23/edit-stale-reply.yaml`(보드 변경), `e2e/jec23/edit-stale-fields.yaml`(메모·태그)에서 상세 조회로 복구한다.   |
| `dropEditBeforeCommit=1`                         | 첫 PATCH 응답을 저장 전에 끊는다. `e2e/jec23/edit-unknown.yaml`에서 현재 상태 확인 후 같은 입력으로 수동 저장한다.                                                              |
| `dropMutationReplies=1&failMutationStatusRead=1` | 구매 반영 직후 응답 유실에 이어 첫 상태 확인이 503. `e2e/jec23/recover-mutation.yaml` 실행.                                                                                     |
| `emptyPurchased=1&failPurchasedOnce=first`       | 구매 목록 직접 진입 → 첫 조회 503 → 재시도 → 빈 목록. `e2e/jec23/purchased-retry.yaml` 실행.                                                                                    |

`dropEditBeforeCommit=1&failEditStatusRead=1`이면 첫 수정 상태 확인만 코드 없는 404를 반환한다. fixture 데이터는 삭제하지 않는다. `mirrorWhileEditing=1`은 위의 응답 유실 옵션과 함께 사용한다. 린넨 블라우스의 원본 URL은 유지하고, 첫 PATCH 처리 시 미러 상태를 `PENDING`에서 `READY`로 바꿔 파일 ID를 붙인다.

fixture는 JEC-79 문서의 구매 POST와 잠정 목록 응답 `{ items, nextCursor }`를 사용한다. 실제 OpenAPI가 나오면 목록 항목 필드·커서·충돌 오류를 대조하고 mock 게이트를 운영 연동으로 바꿔야 한다.

## 배포 계약

[배포 `0277435`](https://github.com/JECT-Study/Ziper-5th-Server/actions/runs/44993618174) 기준으로 [상품 상세 API](https://github.com/JECT-Study/Ziper-5th-Server/pull/83)와 [보드 조회 API](https://github.com/JECT-Study/Ziper-5th-Server/pull/84)를 사용한다.

- `GET /api/v1/products/{cardId}`, `GET /api/v1/boards`, `PATCH /api/v1/products/{cardId}`, `POST /api/v1/products/{cardId}/open-original`은 기존 Bearer 인증을 사용한다.
- 상세나 구매 목록에서 세션 재발급이 401이면 로그인으로 안내한다. 구매 목록은 401·403을 받으면 기존 카드와 액션을 숨긴다. 재발급 자체가 503이거나 네트워크·응답 오류면 로그아웃으로 기록하지 않는다. 페이지네이션은 기존 카드를 유지하며 실패한 커서만 다시 읽고, 구매 목록 직접 진입 실패는 목록 헤더와 재시도 버튼을 유지한다.
- 상세 조회 자체가 이벤트·주기 리셋을 동반하므로 프리로드에서 요청하지 않는다. 화면에서 시작한 읽기는 이탈 시 중단하고, 정상 수정 취소는 기존 상세로 돌아와 다시 읽지 않는다.
- 화면의 ID는 문자열이다. 서버 JSON의 숫자 ID는 안전한 정수인지 검사하고 PATCH의 보드·파일 ID는 숫자로 보낸다. JavaScript 안전 정수 범위 밖의 응답은 거부한다.
- 상품명은 신규 저장·수정에서 연속 ASCII 공백을 한 칸으로 줄인 뒤 200 코드 포인트 한도를 검사하고, 같은 값을 요청에 보낸다. 상품명과 메모의 앞뒤 공백은 서버의 Java `String.strip()` 규칙에 맞춰 처리하고, 줄바꿈 방지 공백(`U+00A0`, `U+2007`, `U+202F`)은 보존한다. HTML 제거는 서버에서 처리한다. 응답 유실 후 새 제목이 제출 값과 다르면 서버 정리인지 별도 수정인지 단정하지 않고 최신 상세 확인을 안내한다.
- 수정에는 0~10억원 정수 가격, 태그 1개 이상(각 6 코드 포인트 이하), 이미지나 대체 도안, 활성 보드 1개 이상이 필요하다. 메모는 앞뒤 공백을 제거한 후 100 코드 포인트까지 저장할 수 있다. 태그는 서버 `TagService`와 같이 NFC로 정규화하고, 앞쪽 `#`·공백을 제거하고 연속 공백을 줄인다. 제어·포맷 문자가 있으면 추가 전에 안내한다.
- 서명 이미지 URL → 원본 이미지 URL → 대체 도안 순서로 표시한다. PATCH에는 임시 서명 URL을 보내지 않는다. 판매 종료 링크는 원본 열기를 막고 품절 링크는 열 수 있다.
- PATCH의 `404 BOARD_NOT_FOUND`·`404 FILE_NOT_FOUND`는 상품 삭제가 아니다. 초안을 유지하고, 보드 오류는 선택 목록만 새로 읽어 사라진 보드를 해제한다. 이미지 오류는 이미지 변경 영역을 열고 새 도안을 선택할 때까지 제출을 막는다. `404 PRODUCT_CARD_NOT_FOUND`는 초안을 읽기 전용으로 유지하고 시트를 닫으면 추가 상세 GET 없이 상품 없음 안내를 표시한다. 코드 없는 404나 알 수 없는 오류 코드는 상품 삭제로 단정하지 않고 결과 확인을 안내한다. 복구 조회·보드 복귀는 브라우저 캐시를 우회한다.
- 수정 응답이 유실되면 수정 시트의 ‘현재 상태 확인’으로 GET만 보낸다. 서버 상태가 제출 내용과 같으면 최신 상세를 표시한다. 조회한 정보에 변경이 없으면 초안을 보존하고 사용자가 다시 저장할 수 있다. 같은 원본 URL의 `READY` 미러에 새 파일 ID만 붙은 경우 다른 필드는 계속 비교하며, 수동 재제출 시 새 ID를 보존한다. 원본 URL이나 직접 지정한 파일 등 제출·이전 값과 다른 변경은 재제출을 막고 ‘최신 상세 보기’를 안내한다. 조회 실패 시에도 초안은 유지한다.
- 응답 유실·5xx·잘못된 성공 응답은 완료 여부를 알 수 없다. [JEC-95](https://linear.app/ject5-team6/issue/JEC-95)처럼 저장이 먼저 반영됐을 수 있으므로 재전송하지 않고 상세를 다시 확인한다.

## Figma와 구현 경계

현재 UI는 [D-1 최신 시안](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=1025-12670)의 라임색·Pretendard, 공통 헤더·하단 원본 이동 버튼, 수정 바텀시트, 구매 확인 모달을 사용한다. 상세의 도안은 Figma 원본을 축소해 로컬에 포함했다. 초기 PRD2 레퍼런스는 [Flow 5 561:5912](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih?node-id=561-5912)이다.

- 최신 D-1 상세의 연한 라임 메모와 38px 소속 보드 칩을 적용했다. 가격은 시안처럼 금액만 표시한다. 최신 수정 프레임 `1085:10015`의 네 가지 입력·보드 체크 목록·‘새 보드 만들기’를 반영했고, 기존 이미지 보존·도안 변경은 접어 두었다. ‘이미지 업로드 실패’ 흐름(`1085:10320` → `1085:10663`)은 저장 후 상세에서 기본 이미지와 안내를 표시한다. PATCH는 상품 URL을 수정하지 않는다.
- 상세의 상품 관리 메뉴는 브라우저와 앱 모두 공통 바텀시트(구매 완료·상품 수정)를 사용한다. D-1의 ‘이 보드에서 삭제’는 JEC-22 범위라 연결하지 않았다.
- 독립 구매 목록은 기존 보드 상품 카드(`ProductCard`)와 하단 탐색을 재사용한다. 서명 이미지가 실패하면 원본 이미지를 시도하고, 그다음 카테고리 도안을 사용한다. 구매한 카드의 더보기는 기존 상세의 ‘상품 수정’만 연결한다. 구매 취소·삭제는 별도 명세가 없어 추가하지 않았다.

## 외부 이동

`external.open.v1 / externalOpenV1`을 협상한다. 웹과 네이티브 양쪽에서 HTTP(S)·userinfo/제어문자 등을 검사하고, 네이티브는 현재 활성 문서에서만 `Linking.openURL`을 호출한다. 기존 외부 문서·팝업 차단 정책을 완화하지 않는다.

브라우저에서는 클릭 안에서 창을 열고 opener를 제거한 뒤 이동한다. 앱의 미지원·오류·응답 유실에는 웹 fallback을 실행하지 않는다. 상세와 구매 목록에서는 외부 열기 성공 후 원본 이벤트를 기록한다. 화면을 이미 떠났다면 요청을 시작하지 않으며, 각 원본 요청은 15초에 종료하고 자동 재전송하지 않는다. `ProductCard.resetRediscoveryCycle`은 `updated_at`도 변경하므로, 구매 목록에서 원본 방문을 기록한 뒤 날짜순(`RECENT`/`OLDEST`)이면 첫 페이지를 다시 읽는다. 가격순은 기존 커서를 사용한다.

## 사용한 공식 문서

- [React useEffect 데이터 조회·정리](https://react.dev/reference/react/useEffect#fetching-data-with-effects): 이탈/늦은 응답 처리.
- [TanStack Router 파일 규칙](https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions): `products.$cardId.tsx` 경로와 파라미터.
- [Vanilla Extract 스타일링](https://vanilla-extract.style/documentation/styling/): 기능 범위의 스타일·선택자, 기존 컴포넌트 조합.
- [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [React Native Linking](https://reactnative.dev/docs/linking#openurl): 헤더 중복 제거와 OS 브라우저 Promise/실패 처리.
- [Vitest mocking](https://vitest.dev/guide/mocking.html): transport/OS 경계만 대역으로 검증, cleanup.
- Figma MCP의 공식 `figma-design-to-code` 리소스와 agent-browser 내장 가이드를 읽고 조회·스크린샷·접근성 검사를 진행했다. PR 첨부는 `gh attach --help`의 `--repo / --markdown` 사용법을 따랐다.

## 검증

2026-11-26 범위 정리(보드별 제거·JEC-22 보드 화면 변경 제외) 후 다시 실행한 결과다.

- `pnpm test` 747건(web 312·bridge 271·mobile 98·api 66), `node --test e2e/jec23/mock-api.test.mjs`, `pnpm lint`, `pnpm typecheck:web` 통과.
- agent-device(iOS 시뮬레이터 `ziper-e2e`, Android 에뮬레이터)에서 `e2e/flows/product-detail-*.yaml` 3개와 `e2e/jec23/*.yaml` 28개(이후 메모·태그 흐름을 합쳐 27개)를 플랫폼마다 순차 실행했다. Android는 하드웨어 Back 흐름 `e2e/flows/android/back-order.yaml`을 추가로 실행했다. 각 흐름 직전에 첫 줄 주석의 `/_reset` 쿼리로 fixture를 초기화했다. 최종 결과는 양 플랫폼 모두 전체 통과다.
  - 첫 실행의 실패 원인은 다음과 같다. 프리뷰 흐름은 자동 로그인 fixture에서 로그아웃 시작 화면을 기다렸다. 흐름 주석에 `expiredSession=1`을 명시했다. `product-link-states`는 JEC-22 범위인 보드 카드 품절 칩을 확인했다. 상세와 구매 목록만 확인하도록 바꿨다. Android `edit-board-membership`은 adb 스냅샷 타임아웃이었고, 재실행에서 통과했다.
  - fixture 요청 로그에 DELETE 요청은 없었다. 구매 POST는 각 흐름에서 한 건씩만 기록됐다.
- 보드 상세에서 상품을 여는 동작은 같은 WebView 안의 이동으로 바꿨다. 앱에서 수정한 뒤 뒤로 가면 보드가 다시 조회되어 변경된 소속이 반영된다(`edit-board-membership`, `edit-stale-reply`). 내 보드 요약의 개수 갱신은 JEC-22 범위로 남긴다.
- 간소화(구매 목록 화면을 feature로 이동, 수정 시트 footer 포커스 처리 통합, 메모·태그 stale 흐름 병합) 후 수정·구매·구매 목록 관련 11개 흐름을 iOS·Android에서 다시 실행해 모두 통과했다.

### 배포 커밋의 백엔드를 로컬에서 실행한 검증 (범위 정리 전 기록)

아래는 보드 화면 변경을 걷어내기 전 코드로 2026-11-26에 실행한 기록이다. 상세 조회·수정·원본 방문 경로는 이후 변경되지 않았다.

- 최신 응답 검증을 적용한 개발 웹을 `0277435`의 CI JAR·새 PostgreSQL에 연결했다. 로컬 가입·쿠키 재발급 후 업로드 파일이 있는 카드에서 상품명의 연속 공백과 분해형 한글 태그를 입력해, 정규화된 값이 실제 서버에 저장되는 것을 확인했다. 이어 기존 파일을 같은 `TOP` 도안으로 교체하는 PATCH도 성공했다. 두 저장은 PATCH 200 각 한 건, 최초 상세 GET 성공 한 건으로 끝났으며, 원래 `PRICE_ASC` 보드에서 새 상품명과 태그를 확인했다. PostgreSQL에서 사진 파일 ID·원본 URL은 모두 비었고 메모·가격·보드 연결은 유지됐다. 업로드에는 서버의 로컬 메모리 스토리지를 사용했다. 운영 서명 URL이나 미러 작업은 검증하지 않았다.

최신 운영 배포 실행 `44993618174`의 커밋 `0277435`와 같은 [CI 실행 `44993313667`](https://github.com/JECT-Study/Ziper-5th-Server/actions/runs/44993313667)의 `tested-release` JAR를 사용했다. 별도 로컬 PostgreSQL에 Flyway를 실행하고, 로컬 메일 수신기로 전용 계정을 가입시켰다. 웹의 모든 `/api` 요청은 이 JAR로만 전달했다. 프리뷰, HTTP fixture, 운영 서버는 사용하지 않았다.

- Chrome에서 이메일 로그인과 쿠키 재발급 후 상세에서 ‘상품 수정’을 선택한 뒤 상세 GET 200, 가격 `45,900원`·메모·소속 보드 변경 PATCH 200이 각각 한 건이었다. 이전 보드로 복귀했을 때 해당 카드가 사라지고, 남은 보드에서 다시 열었을 때 수정 값이 표시됐다. DB에는 정수 `45900`, 수정 메모, 남은 보드 연결 한 개가 저장됐고 상품은 `PLANNED`이며 삭제되지 않았다.
- 상세의 외부 창 열기 핸들만 대역을 사용했다. 팝업이 차단되면 POST가 없고, 테스트 URL을 여는 데 성공한 뒤에만 원본 방문 POST 200 한 건이 전송됐다. DB에서 `VIEW_DETAIL` 두 건과 `OPEN_ORIGINAL_URL` 한 건, 마지막 상호작용과 다음 재발견 사이의 14일 간격을 확인했다. 외부 쇼핑몰과 운영 큐를 검증한 것은 아니다.
- 별도 인증 요청으로 수정 시트에서 선택한 빈 테스트 보드를 먼저 삭제했다. Chrome 320×568에서 PATCH 404 뒤 보드 선택지만 새로 조회했고, 사라진 보드는 빠지고 메모 초안은 남았다. 사용자가 다시 저장한 뒤에만 두 번째 PATCH가 200이었으며, 상세를 다시 읽지 않고 나머지 보드와 메모가 DB에 저장됐다. 이때 삭제한 것은 로컬 테스트 보드이며, JEC-79 개별 상품 제거 API가 아니다.
- Chrome 375×812의 실제 데이터 상세·수정 시트를 D-1 `1025:11169`·`1085:10015`와 대조했다. 실제 일반 보드 API에서 `PRICE_ASC&size=1`의 응답 커서로 다음 페이지도 조회했다. JAR가 생성한 OpenAPI(31개 operation)에는 상세 GET·PATCH·원본 방문이 있으나 구매 전환·구매 목록은 없다.

- 릴리스 웹 번들도 같은 로컬 JAR에 연결했다. 브라우저의 API 주소만 루프백으로 바꿨으며, 응답은 대역을 쓰지 않았다. 두 번째 로컬 계정으로 로그인하자 다른 계정의 카드와 존재하지 않는 카드 모두 인증 요청에 404를 반환했고, 같은 안내가 표시됐다. 상품명·이미지·관리·원본 이동은 노출되지 않았으며 변경 요청은 없었다. PostgreSQL에서 첫 계정의 카드 값·보드 연결·방문 이벤트가 전후 동일했다. 두 번째 계정 소유 카드에서는 `?preview=offline`이 무시됐고, 메모 PATCH 한 건이 성공해 새로고침 뒤 상세와 DB에 반영됐다. `/products/purchased`의 Not Found는 목록 API를 호출하지 않았다.

- [JEC-95](https://linear.app/ject5-team6/issue/JEC-95)의 커밋 후 서명 장애를 릴리스 웹·같은 CI JAR·PostgreSQL에서 재현했다. API 응답은 대역을 쓰지 않고, 로컬 스토리지의 일괄 서명 응답만 한 번씩 503으로 바꿨다. 실제 업로드 API가 만든 WebP를 포함한 상품을 Chrome에서 수정하자 PATCH는 500이었지만, 상태 확인 전 DB에 수정 메모가 이미 저장됐고 기존 파일 ID·보드 연결은 그대로였다. ‘현재 상태 확인’으로 GET만 보내 성공 응답과 이미지를 복구했다. 첫 확인 GET의 서명까지 실패한 별도 실행에서도 초안을 읽기 전용으로 유지했고, 두 번째 확인으로 복구했다. 실행당 PATCH 한 건, 자동 GET 재시도·업로드 재전송 없음. 375px 화면에서 복구 안내와 고정 하단 버튼을 확인했다. 이 테스트는 운영 스토리지의 가용성이나 서명 URL의 접근 제어를 검증하지 않는다.

**미검증:** 운영 인증·스토리지·큐는 전용 테스트 계정에서 확인해야 한다. JEC-79 기능의 운영 활성화는 API 계약과 배포를 확인할 때까지 보류한다.
