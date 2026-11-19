# 웹–네이티브 브릿지

브라우저에서는 웹 구현을, 지원되는 WebView에서는 네이티브 구현을 사용한다. 실제 인증 SDK와 서버는 별도로 연결해야 하며 기본 앱에 가짜 로그인은 없다.

## 구조와 사용

- `packages/bridge/src/contract.ts`: 버전별 계약과 기능 및 서비스 인터페이스
- `packages/bridge/src/runtime.ts`: 브릿지 실행과 인증 흐름
- `apps/ziper-web/src/bridge/`, `platform/`: Provider, TanStack 라우팅과 웹 시트
- `apps/ziper-mobile/src/bridge/`, `screens/web-screen.tsx`: 화면과 문서별 delegate, 네이티브 Stack과 시트

경로는 저장소 루트 기준이다. 웹의 루트에 있는 `BridgeProvider`에서 제공하는 API를 사용한다.

```tsx
const { platform } = usePlatform();
await platform.navigation.push('/profile'); // replace, back도 제공
await platform.sheets.actions({ title: '작업 선택', actions: [{ id: 'save', label: '저장' }] });
await platform.auth.login('kakao'); // 인증 adapter 필요; restore, logout도 제공
```

주요 화면 이동에는 `platform.navigation`을, 화면 내부 탭과 필터에는 TanStack Router를 사용한다. 네이티브 화면으로 이동한 뒤 기존 WebView에서 중복 이동하지 않는다. Provider는 웹 history를 네이티브에 동기화한다. Provider에 전달하는 설정과 서비스의 참조는 안정적으로 유지하고, 직접 만든 runtime은 dispose한다.

네이티브 기능과 메서드가 모두 지원될 때만 네이티브 구현을 사용한다. 웹 fallback은 기능이 없거나 **부작용이 없다고 보장된 `UNSUPPORTED`**일 때만 허용한다. 취소는 정상 결과다. 인증이나 권한 오류, 연결 종료, handshake 실패, 응답 유실은 fallback하지 않는다.

RPC 기본 기한은 handshake 3초, 일반 호출 5초, 로그인과 시트 호출 180초다. `config.runtime`으로 조정할 수 있다. `RESULT_UNKNOWN`은 실행 취소나 미실행을 보장하지 않는다.

v1 입력은 엄격하게 고정한다. 새 입력 필드는 버전이나 기능 협상 없이 보내지 않는다. 출력의 추가 필드는 이전 웹 클라이언트가 무시할 수 있다.

## 액션 바텀시트

- `platform.sheets.actions()`는 한 번에 한 시트만 연다. 동시 호출은 `PERMISSION_DENIED`다. 호출자는 요청 ID를 지정하지 않으며, 매 호출에 새 ID를 발급한다. 네이티브 전송 계층에서의 중복 제거는 그대로 유지한다.
- 브라우저 또는 지원되지 않는 앱에서는 디자인 시스템 `BottomSheet`를, 지원 앱에서는 문서 범위의 `SheetSessions`와 Expo UI 시트를 사용한다. 선택은 `{ status: 'selected', actionId }`, 사용자 닫기는 `{ status: 'cancelled' }`이다. 실제 저장·삭제는 호출 화면에서 실행한다.
- 웹은 X/취소/배경/Escape 또는 경로 이탈 시 닫힌다. 같은 경로의 쿼리·해시 변경은 시트를 유지한다. 네이티브는 취소/플랫폼 dismiss(스와이프, Android Back 등)로 닫는다. 연결 종료는 `BRIDGE_CLOSED`다. `RESULT_UNKNOWN`은 웹이 응답을 더 이상 기다리지 않는다는 뜻이지 네이티브가 자동으로 닫힌다는 뜻이 아니다. 웹 시트 전환이나 자동 재호출 없이 사용자가 네이티브 시트를 닫을 수 있어야 한다.
- 웹의 `platformErrorMessage`는 브릿지 오류를 화면용 문구로 바꾼다. 화면 이탈로 인한 종료와 정상 취소에는 알림을 띄우지 않는다. 기능별 검증·실패 처리는 호출부 책임이다.
- 브라우저의 `/design-system` 또는 개발 빌드의 딥 링크 `ziper://web?path=%2Fdesign-system`에서 **공통 액션 시트 열기**와 **긴 액션 시트 열기**(20개 항목)를 사용한다. 브라우저는 시트의 포커스와 Escape를, 앱은 동작 결과, 시트 우선 Back, 연속 닫기/재열기, 긴 콘텐츠 스크롤·safe area를 확인한다. 자동 테스트는 네이티브 UI를 모킹한다.
- 디자인 컴포넌트 인벤토리와 플랫폼별 패키지 제안은 [디자인 시스템 조사](../../../docs/design-system-jec-24.md)를 참고한다.

## 외부 링크 공유

- Expo의 공유 URL은 앱 진입 신호로만 사용한다. 네이티브가 원본을 읽고 앱 단위 인박스에 보관하며, 활성 WebView가 `share.incoming.v1` 협상 후 `shareReadV1`으로 조회한다.
- 초기 handshake와 포커스/변경 시의 `ziper:incoming-share` 이벤트로 조회한다. 이벤트, 라우트, WebView 주소에는 공유 URL을 싣지 않는다. 완료/취소 시 `shareDismissV1`은 해당 ID만 제거하며 재호출해도 안전하다.
- 인박스는 최대 8건을 순서대로 유지하며 실행 중에만 유효하다. 아직 대기 중인 같은 URL은 합친다. 브라우저나 공유 미지원 네이티브에서는 읽기 결과가 없고, 이 계약이 서버 저장의 중복 방지를 대신하지 않는다.

## 인증 연결

- 웹 `BridgeProvider.config.auth`: `WebAuthService`의 웹 로그인 adapter와 `SessionClient`
- Native `MobileServicesProvider.auth`: `NativeAuthService`의 `providers`, `login`, `openBrowser?`, `restore`, `adopt`, `logout`

미주입 시 웹은 `AUTH_NOT_CONFIGURED`, native는 인증 capability 없이 `UNSUPPORTED`를 반환한다. `providers`는 설치된 native SDK 목록이며 브라우저 인증 지원과 별개다. 브라우저 인증은 정해진 provider만 받고 임의 URL을 열지 않는다. 일반 웹의 로그인 adapter는 첫 await 전에 호출되어 popup/redirect를 직접 제어한다.

세션 HTTP 구현은 제공하지 않는다. 실제 백엔드에 맞춰 웹 앱에서 `SessionClient`를 구현해야 한다. 구현 시 같은 origin과 응답 검증, redirect 거부, 쿠키와 캐시 정책을 확인하고 오류 본문이나 토큰을 노출하지 않아야 한다. 결과가 불확실한 변경 요청은 자동으로 재시도하지 않는다. SSR 어댑터는 사용자별 쿠키를 격리해야 하며 외부 HTTP와 SDK의 기한 및 취소 처리도 각 어댑터의 책임이다.

네이티브 로그인은 일회용 handoff를 웹 세션으로 교환한다. 웹 fallback 로그인은 지원되는 네이티브에 별도 handoff를 전달한다. `login`은 세션 또는 취소를, `restore`는 세션 또는 null을 반환한다. 동시 로그인은 막고 logout은 오래된 결과를 무효화하며 웹과 네이티브 정리를 각각 시도한다.

실제 연결에는 다음이 필요하다.

- **백엔드:** provider와 callback을 검증하고 transaction, preauth, 수신자를 결합한다. 코드의 TTL과 원자적인 1회 소비, CSRF와 origin 검증, HttpOnly, Secure, SameSite 쿠키, 세션 회전과 폐기를 보장한다.
- **네이티브 어댑터:** SecureStore 등에 자격 증명을 보관하고 화면 간 SDK 실행 순서를 제어한다. logout 이후 늦게 완료된 SDK가 자격 증명을 복원하지 않도록 한다. SDK 실행 후 실패를 `UNSUPPORTED`로 바꾸지 않는다.

## Native 보안과 수명

실행법과 주소는 [모바일 안내](../../../apps/ziper-mobile/README.md)를 참고한다. 운영에는 HTTPS `EXPO_PUBLIC_WEB_URL`이 필수다.

- Scheme/host/port/base path를 검사해 외부 페이지, popup, 파일 URL을 차단한다. Back 순서는 **시트 → 웹 history → native pop → OS root**이며 시트/history가 있으면 native swipe/pop을 제한한다.
- 응답은 요청한 WebView/문서에만 전달한다. Blur/unmount/문서 교체 시 오래된 callback을 정리한다. Android `onLoadStart`는 SPA에서도 발생하므로 document identity로 교체를 구분한다. 이 identity는 인증 토큰이나 검증된 송신 origin이 아니다.
- OperationId는 불투명 ID이며 화면별 dedup은 최대 64개, 완료 후 120초다. 범위 밖 재시도는 재실행될 수 있으며 서버 거래의 idempotency를 대신하지 않는다.
- Middleware의 URL은 **최상위 문맥이지 인증된 iframe origin이 아니다.** 서버에 `script-src`와 nonce, `frame-src`, `frame-ancestors` 등 CSP를 설정하고 SDK origin을 검토해야 한다. 브릿지는 동일 origin XSS를 해결하지 않는다.

## 패치와 검증

`patches/`와 `pnpm-workspace.yaml`의 `@webview-bridge/{web,utils,react-native}@1.9.0`을 함께 사용한다. 패치는 요청, 타이머, 구독을 정리하고 메시지 검증, 안전한 주입, 문서 간 응답 격리를 제공한다. Upstream 그대로의 API가 아니므로 **패치된 웹과 네이티브를 한 쌍으로 사용**한다. identity가 없는 이전 클라이언트와의 호환은 가정하지 않는다. 버전 변경 시 프로토콜 회귀 테스트를 실행하고 dev server의 dependency cache를 재시작한다.

[루트 README](../../../README.md#검증)의 테스트는 패치된 브릿지의 CommonJS 배포 코드, 운영 handler와 Expo Router JavaScript를 검증하지만 네이티브 경계는 모킹한다. 이 테스트는 Metro가 선택하는 React Native 소스나 실제 WebView를 직접 검증하지 않는다. Metro export도 네이티브 컴파일이 아니다. 실제 백엔드, 세션 HTTP 구현, 기기의 뒤로 가기 및 제스처, OAuth, SecureStore, 운영 쿠키 보안은 검증되지 않았다.
