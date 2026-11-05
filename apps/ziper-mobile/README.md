# Ziper Mobile

Expo Go 대신 development build를 사용합니다.
iOS는 Xcode와 CocoaPods, Android는 Android SDK와 JDK가 필요합니다.
저장소 루트에서 실행하세요.

```sh
pnpm install
pnpm --filter ziper-mobile ios
# 또는
pnpm --filter ziper-mobile android
```

처음 실행할 때 앱 식별자를 입력합니다.
development build를 설치한 뒤에는 Metro만 시작할 수 있습니다.

```sh
pnpm --filter ziper-mobile start
```

네이티브 의존성을 변경하면 `ios` 또는 `android` 명령으로 다시 빌드하세요.
