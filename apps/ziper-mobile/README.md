# Ziper Mobile

Expo Router Stack 안에 WebView를 표시합니다. Unistyles를 초기화한 뒤 Router를 로드하며, **Expo Go 대신 development binary**를 사용합니다.

iOS는 Xcode와 CocoaPods, Android는 Android SDK와 JDK가 필요합니다.
저장소 루트에서 실행하세요. 웹 서버는 별도 터미널에서 실행합니다.

```sh
pnpm dev:web
pnpm ios:mobile # 또는 android:mobile. 최초 binary 빌드
pnpm dev:mobile # 이후 개발 서버 재실행
```

개발 환경의 기본 주소는 iOS에서 `http://localhost:3000`, Android 에뮬레이터에서 `http://10.0.2.2:3000`입니다. 실제 기기를 사용할 때는 웹 서버를 LAN에 바인딩하고 개발 PC의 주소를 지정하세요.

운영 환경에서는 HTTPS 주소를 명시해야 합니다.

```sh
EXPO_PUBLIC_WEB_URL=https://your-service.example pnpm ios:mobile
```

네이티브 의존성을 변경하면 `ios` 또는 `android` 명령으로 다시 빌드하세요.

`pnpm --filter ziper-mobile test`는 단위 테스트와 iOS 및 Android 설정의 Expo Router 테스트를 실행합니다. Router와 React Native JavaScript는 실제 코드를 사용하지만 WebView와 네이티브 UI는 모킹하므로 시뮬레이터나 실기기 검증을 대신하지 않습니다.

인증 어댑터, 보안 및 검증 범위는 [브릿지 문서](../../packages/bridge/docs/bridge.md)를 참고하세요. 전체 검증 명령은 [루트 README](../../README.md#검증)에 있습니다. 기본 앱에는 인증 SDK가 없으며 Metro export는 네이티브 컴파일이나 기기 검증을 대신하지 않습니다.
