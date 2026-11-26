# E2E (agent-device)

[agent-device](https://github.com/callstack/agent-device)로 iOS 시뮬레이터와 Android 에뮬레이터에서 앱(개발 바이너리 + WebView)을 실제로 조작한다. 단위·라우터 테스트(`pnpm test`)가 모킹하는 WebView, 브릿지, 네이티브 시트, 딥링크, 하드웨어 Back을 확인하는 용도다.

## 구성

- `flows/*.yaml`: 두 플랫폼 공통 시나리오. agent-device의 Maestro 호환 모드(`--maestro`)로 실행한다.
- `flows/<platform>/*.yaml`: 한 플랫폼에만 있는 동작(예: Android 하드웨어 Back).
- `subflows/`: 앱 실행(dev client를 Metro에 연결), 딥링크 열기, iOS의 "Open in Ziper?" 확인.
- `setup.sh ios|android`: `ziper-e2e` 시뮬레이터 또는 AVD를 만들고 부팅한다.
- `build.sh ios|android`: 개발 바이너리를 빌드해 설치한다.
- `run.sh ios|android [flow...]`: 웹(3000)과 Metro(일반 8081, JEC-23 전용 8082)를 준비하고 시나리오를 실행한다. 결과는 `e2e/.artifacts/<platform>/`에 남는다(JUnit, 실패 시 화면 정보).

기본 `flows/` 시나리오는 JEC-23 HTTP fixture(`node e2e/jec23/mock-api.mjs`, `VITE_JEC23_MOCK=1`, [JEC-23 안내](../docs/jec-23-product-detail.md))의 상품과 `/design-system`의 액션 시트 데모를 쓴다. 상품 상세 흐름은 실행 전마다 `POST /_reset`으로 fixture 를 로그인 상태로 되돌린다. 화면 진입은 딥링크 `ziper://web?path=<URL 인코딩한 경로>`로 한다.

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

`e2e/jec23/`는 상품 수정·구매·구매 목록에 로컬 HTTP fixture를 사용한다. 실행 전 [JEC-23 설정](../docs/jec-23-product-detail.md#로컬-http-통합-검증)에 따라 fixture와 mock 모드의 웹을 띄운다. 실행기는 웹 프록시에서 fixture 응답을 받지 못하거나 8082에 이미 서버가 있으면 중단한다. JEC-23용 Metro는 로컬 fixture 웹 주소를 사용하며, 셸이나 Expo `.env`의 다른 `EXPO_PUBLIC_WEB_URL` 및 기존 8081 Metro를 재사용하지 않는다.

가상 이메일 계정으로 로그인부터 검증하려면 실행 직전에 `curl -fsS -X POST 'http://127.0.0.1:3011/_reset?auth=email'`로 초기화하고, `e2e/jec23/email-session.yaml`을 지정한다. 구매 중 만료 토스트와 로그인 화면으로 강제 이동하지 않는 동작은 `auth=email&expireSessionOnPurchase=1`로 초기화한 뒤 `e2e/jec23/email-purchase-expiry.yaml`로 확인한다. 상태를 공유하므로 플랫폼·시나리오를 순차 실행한다.

## 실제 쇼핑몰 자동 입력 재검증

`e2e/live/product-extraction.yaml`은 기본 실행과 CI에 포함하지 않는다. 포트 3000에 로그인과 등록에 필요한 Ziper API(쿠키 재발급·규칙·URL 확인·보드 조회)를 제공하는 테스트 환경을 먼저 띄운다. 앱에서 테스트 계정으로 로그인하거나 fixture에서 테스트용 HttpOnly 세션을 제공해야 한다. 시나리오는 앱을 다시 띄운 뒤 로그인된 홈의 ‘상품 추가’로 진입하고 저장은 누르지 않는다. 운영 API와 fixture 사용을 구분해서 기록한다. 상품 페이지는 앱의 WebView가 실제로 로드한다.

가격의 대조 기준은 정규 주소가 아니라 **제출할 링크를 그대로 열었을 때의 공개 표시가**다. 같은 상품도 행사 파라미터 유무에 따라 금액이 다를 수 있다. `CI=1`로 시작한 Metro는 변경을 감시하지 않으므로 앱이나 브리지 코드를 바꿨다면 Metro를 재시작한 뒤 비교한다.

```sh
AD_VAR_PRODUCT_URL=https://a-bly.com/app/goods/13519743 \
  AD_VAR_EXPECTED_PRICE='26,800' AD_VAR_EXPECTED_TITLE='.*니트 원피스 모음.*' \
  pnpm e2e:android e2e/live/product-extraction.yaml

# 상품 폼의 실제 입력값을 비교한다. 예상값은 원본 상품 페이지에서 먼저 확인한다.
# Android에서는 아래의 e2e:ios를 e2e:android로, --platform ios를 --platform android로 바꾼다.
AD_VAR_PRODUCT_URL=https://www.musinsa.com/products/193764 \
  AD_VAR_SCREENSHOT_PATH="${TMPDIR:-/tmp}/ziper-musinsa" \
  pnpm e2e:ios e2e/live/product-extraction.yaml
agent-device --session ziper-field-check --platform ios --device ziper-e2e \
  open com.ject.ziper --foreground
snapshot=$(mktemp)
agent-device --session ziper-field-check snapshot -i --json > "$snapshot"
agent-device --session ziper-field-check close
node e2e/live/assert-product-fields.mjs "$snapshot" \
  'https://www.musinsa.com/products/193764' \
  'ABERCROMBIE [아베크롬비] Bold Color Flip Flops 남성 쪼리 (레드)' '40,000'
rm -f "$snapshot"
```

이 흐름은 상품명·가격이 채워지고 대표 이미지가 실제로 로드돼 자동 입력 문구가 뜨는지 확인한다. 선택 인자 `EXPECTED_PRICE`, `EXPECTED_TITLE`은 Maestro 텍스트 선택자(정규식)로 비교한다. 정확도 검증에는 위처럼 양 OS에서 현재 폼의 값(`TextField.value`)을 읽어 정규 주소·전체 이름·가격을 비교한다. Android에서 필드 이름은 접근성 힌트(`placeholder`), iOS에서는 `label`로 찾는다. 대표 이미지 일치는 별도로 원본의 실제 대표 컷과 비교한다. `SCREENSHOT_PATH`를 지정하면 수동 입력·부분 입력으로 끝난 화면도 실패 판정 전에 캡처한다. 대상 링크와 실패 사유는 [상품 추출 QA](../docs/jec-17-20-product-extraction-qa.md)에 기록한다.

지그재그에서는 같은 상품 번호를 가진 여러 `og:image`가 서로 다른 갤러리 사진일 수 있다. 모바일 브라우저에서 **첫 슬라이드**와 폼의 이미지를 대조한다. 크기나 포맷만 다른 같은 사진은 성공, 두 번째 이후의 착용 컷 등 다른 사진은 실패다.

## 선택자 규칙

- WebView 안의 웹 요소는 접근성 트리로만 보인다. `data-testid`는 보이지 않으니 `aria-label`, role, 화면 문구로 찾는다.
- 네이티브 요소는 `testID`로 찾는다. 예: 액션 시트의 `sheet-action-<id>`, `sheet-cancel`, 로딩 실패 화면의 `web-retry`
- Maestro의 텍스트 선택자는 전체 일치(정규식)다. 앞뒤에 기호가 붙은 문구는 `".*구매 완료 목록으로 이동했어요"`처럼 쓴다.
- 화면 밖 요소는 `assertVisible` 대신 `scrollUntilVisible`로 확인한다.

## 알아 둘 점

- **iOS 빌드는 `pnpm ios:mobile`(expo run:ios)이 아니라 `e2e/build.sh`로 한다.** 앱에 entitlement(Apple 로그인, 공유 확장)가 있으면 Expo가 시뮬레이터 빌드에도 서명 팀을 요구하기 때문이다. 시뮬레이터는 ad-hoc 서명이면 충분하다.
- dev client는 데이터를 지운 첫 실행에서 런처와 dev menu를 띄운다. `subflows/launch.yaml`의 `__expo_disable_*` 파라미터가 이를 건너뛴다. Android는 `run.sh`가 dev client의 `ACCESS_LOCAL_NETWORK` 권한을 미리 허용한다.
- Nix 셸에서 iOS 테스트 러너 빌드가 `ld: -objc_abi_version '-Xlinker' not supported`로 실패하면 앱이나 상품 제출 전의 도구 오류다. iOS 테스트를 실행하는 서브셸에서 `unset LD CC CXX SDKROOT` 하고 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`와 그 Xcode의 `Toolchains/XcodeDefault.xctoolchain/usr/bin`을 PATH 앞에 지정한다.
- iOS 시뮬레이터는 실행 중인 앱에 URL을 열 때 확인 창을 띄울 수 있다. 딥링크는 `subflows/open-link.yaml`로 연다.
- 기기 이름은 두 플랫폼 모두 `ziper-e2e`다. agent-device를 직접 쓸 때는 `--platform`을 함께 준다.
- `nix develop`은 실행할 때마다 `TMPDIR`이 바뀌고, agent-device daemon도 그에 따라 따로 뜬다. 다른 셸에서 열어 둔 세션이 기기를 점유하고 있으면 `run.sh`가 `DEVICE_IN_USE`로 실패한다. 그 셸에서 `agent-device close`로 닫는다.

## 범위 밖

카카오·네이버·Apple 로그인(실제 SDK와 계정 필요), 실서버 연동, iOS 공유 확장(시뮬레이터 자동화가 불안정해 실기기에서 수동 확인). Android 공유 인텐트는 `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT <url> -p com.ject.ziper`로 수동 확인한다.
