#!/usr/bin/env bash
# E2E 용 시뮬레이터/에뮬레이터를 만들고 부팅한다(이미 있으면 그대로 둔다). 앱 설치는 e2e/build.sh.
# 사용법: e2e/setup.sh ios|android
set -euo pipefail

name=ziper-e2e

case "${1:-}" in
  ios)
    if xcrun simctl list devices | grep -q " $name ("; then
      echo "simulator $name exists"
    else
      # 첫 번째 iOS runtime 과, 그 runtime 이 지원하는 마지막(가장 새) 기본 iPhone 을 고른다.
      read -r runtime type < <(xcrun simctl list runtimes available -j | node -e '
        const rt = JSON.parse(require("fs").readFileSync(0, "utf8")).runtimes.find((r) => r.platform === "iOS");
        const num = (d) => Number(d.name.slice(7));
        const phone = rt?.supportedDeviceTypes
          .filter((d) => /^iPhone \d+$/.test(d.name))
          .sort((a, b) => num(a) - num(b))
          .at(-1);
        if (rt && phone) console.log(rt.identifier, phone.identifier);
      ')
      [ -n "${runtime:-}" ] || {
        echo "no iOS runtime: xcodebuild -downloadPlatform iOS" >&2
        exit 1
      }
      xcrun simctl create "$name" "$type" "$runtime"
    fi
    xcrun simctl bootstatus "$name" -b
    ;;
  android)
    : "${ANDROID_HOME:?ANDROID_HOME 가 없습니다. #mobile 셸에서 실행하세요.}"
    # avdmanager 는 XDG_CONFIG_HOME/.android 에 만들 수 있지만 emulator 는 ANDROID_AVD_HOME 을 본다.
    # 두 도구가 같은 위치를 쓰도록 맞춘다.
    if [ -n "${ANDROID_AVD_HOME:-}" ]; then export ANDROID_USER_HOME="$(dirname "$ANDROID_AVD_HOME")"; fi
    if emulator -list-avds | grep -qx "$name"; then
      echo "avd $name exists"
    else
      image="$(ls -d "$ANDROID_HOME"/system-images/*/google_apis/* | tail -1)"
      package="${image#"$ANDROID_HOME"/}"
      echo no | avdmanager create avd -n "$name" -k "${package//\//;}" -d pixel_7
    fi
    if ! adb devices | grep -q '^emulator-'; then
      nohup emulator -avd "$name" -no-snapshot-save -no-boot-anim >/dev/null 2>&1 &
    fi
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
    echo "emulator booted"
    ;;
  *)
    echo "usage: e2e/setup.sh ios|android" >&2
    exit 2
    ;;
esac
