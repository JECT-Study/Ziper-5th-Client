# E2E (agent-device)

[agent-device](https://github.com/callstack/agent-device)로 iOS 시뮬레이터와 Android 에뮬레이터에서 앱(개발 바이너리 + WebView)을 실제로 조작한다. 단위·라우터 테스트(`pnpm test`)가 모킹하는 WebView, 브릿지, 네이티브 시트, 딥링크, 하드웨어 Back을 확인하는 용도다.

## 구성

- `flows/*.yaml`: 두 플랫폼 공통 시나리오. agent-device의 Maestro 호환 모드(`--maestro`)로 실행한다.
- `flows/<platform>/*.yaml`: 한 플랫폼에만 있는 동작(예: Android 하드웨어 Back).
- `subflows/`: 앱 실행(dev client를 Metro에 연결), 딥링크 열기, iOS의 "Open in Ziper?" 확인.
- `setup.sh ios|android`: `ziper-e2e` 시뮬레이터 또는 AVD를 만들고 부팅한다.
- `build.sh ios|android`: 개발 바이너리를 빌드해 설치한다.
- `run.sh ios|android [flow...]`: 웹(3000)과 Metro(8081)가 꺼져 있으면 띄우고 시나리오를 실행한다. 결과는 `e2e/.artifacts/<platform>/`에 남는다(JUnit, 실패 시 화면 정보).

시나리오는 웹 dev 서버의 상품 상세 프리뷰 fixture(`?preview=…`, [JEC-23 안내](../docs/jec-23-product-detail.md))와 `/design-system`의 액션 시트 데모를 쓴다. 따라서 백엔드와 로그인이 필요 없다. 화면 진입은 딥링크 `ziper://web?path=<URL 인코딩한 경로>`로 한다.

## 준비 (최초 1회)

Nix를 쓰면 모든 명령을 flake의 `#mobile` 셸 안에서 실행한다. 테스트할 때만 `nix develop <flake>#mobile`로 들어가면 되며 `.envrc`는 바꾸지 않는다. 이 셸에는 JDK 17, Android SDK·에뮬레이터·이미지, CocoaPods, agent-device가 들어 있다.

1. Xcode와 iOS runtime을 설치한다.
   ```sh
   sudo xcodebuild -license accept
   sudo xcodebuild -runFirstLaunch
   xcodebuild -downloadPlatform iOS -architectureVariant arm64
   ```
2. 기기를 만든다. `pnpm e2e:setup:ios`, `pnpm e2e:setup:android`
3. 개발 바이너리를 설치한다. `pnpm e2e:build:ios`, `pnpm e2e:build:android` (네이티브 의존성이 바뀌었을 때만 다시 실행)
4. 확인한다. `agent-device doctor --platform ios`, `agent-device doctor --platform android`

## 실행

```sh
pnpm e2e:ios
pnpm e2e:android
pnpm e2e:android e2e/flows/launch.yaml   # 일부만
```

## 선택자 규칙

- WebView 안의 웹 요소는 접근성 트리로만 보인다. `data-testid`는 보이지 않으니 `aria-label`, role, 화면 문구로 찾는다.
- 네이티브 요소는 `testID`로 찾는다. 예: 액션 시트의 `sheet-action-<id>`, `sheet-cancel`, 로딩 실패 화면의 `web-retry`
- Maestro의 텍스트 선택자는 전체 일치(정규식)다. 앞뒤에 기호가 붙은 문구는 `".*구매 완료 목록으로 이동했어요"`처럼 쓴다.
- 화면 밖 요소는 `assertVisible` 대신 `scrollUntilVisible`로 확인한다.

## 알아 둘 점

- **iOS 빌드는 `pnpm ios:mobile`(expo run:ios)이 아니라 `e2e/build.sh`로 한다.** 앱에 entitlement(Apple 로그인, 공유 확장)가 있으면 Expo가 시뮬레이터 빌드에도 서명 팀을 요구하기 때문이다. 시뮬레이터는 ad-hoc 서명이면 충분하다.
- dev client는 데이터를 지운 첫 실행에서 런처와 dev menu를 띄운다. `subflows/launch.yaml`의 `__expo_disable_*` 파라미터가 이를 건너뛴다. Android는 `run.sh`가 dev client의 `ACCESS_LOCAL_NETWORK` 권한을 미리 허용한다.
- iOS 시뮬레이터는 실행 중인 앱에 URL을 열 때 확인 창을 띄울 수 있다. 딥링크는 `subflows/open-link.yaml`로 연다.
- 기기 이름은 두 플랫폼 모두 `ziper-e2e`다. agent-device를 직접 쓸 때는 `--platform`을 함께 준다.
- `nix develop`은 실행할 때마다 `TMPDIR`이 바뀌고, agent-device daemon도 그에 따라 따로 뜬다. 다른 셸에서 열어 둔 세션이 기기를 점유하고 있으면 `run.sh`가 `DEVICE_IN_USE`로 실패한다. 그 셸에서 `agent-device close`로 닫는다.

## 범위 밖

카카오·네이버·Apple 로그인(실제 SDK와 계정 필요), 실서버 연동, iOS 공유 확장(시뮬레이터 자동화가 불안정해 실기기에서 수동 확인). Android 공유 인텐트는 `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT <url> -p com.ject.ziper`로 수동 확인한다.
