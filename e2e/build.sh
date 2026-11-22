#!/usr/bin/env bash
# E2E 용 개발 바이너리를 빌드해 ziper-e2e 시뮬레이터/에뮬레이터에 설치한다(e2e/setup.sh 이후).
# 사용법: e2e/build.sh ios|android
set -euo pipefail

mobile="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/ziper-mobile" && pwd)"
cd "$mobile"

case "${1:-}" in
  ios)
    # expo run:ios 는 앱에 entitlement(Apple 로그인·공유 확장)가 있으면 시뮬레이터 빌드에도 서명 팀을 요구한다.
    # 시뮬레이터는 ad-hoc 서명으로 충분하므로 prebuild 후 xcodebuild 로 직접 빌드한다.
    pnpm exec expo prebuild --platform ios --no-install
    (cd ios && pod install)
    xcodebuild -workspace ios/Ziper.xcworkspace -scheme Ziper -configuration Debug \
      -sdk iphonesimulator -destination 'platform=iOS Simulator,name=ziper-e2e' \
      -derivedDataPath ios/build/e2e COMPILER_INDEX_STORE_ENABLE=NO -quiet build
    xcrun simctl install ziper-e2e ios/build/e2e/Build/Products/Debug-iphonesimulator/Ziper.app
    ;;
  android)
    pnpm exec expo run:android --no-bundler
    ;;
  *)
    echo "usage: e2e/build.sh ios|android" >&2
    exit 2
    ;;
esac
