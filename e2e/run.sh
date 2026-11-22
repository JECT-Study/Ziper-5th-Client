#!/usr/bin/env bash
# agent-device 로 iOS 시뮬레이터 / Android 에뮬레이터에서 e2e/flows 의 Maestro YAML 을 실행한다.
# 사용법: e2e/run.sh ios|android [flow.yaml(레포 루트 기준)...]
# 웹(3000)·Metro(8081)가 꺼져 있으면 띄우고, 이 스크립트가 띄운 프로세스만 끝낼 때 정리한다.
set -euo pipefail

platform="${1:-}"
case "$platform" in
  ios | android) shift ;;
  *)
    echo "usage: e2e/run.sh ios|android [flow.yaml...]" >&2
    exit 2
    ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifacts="$root/e2e/.artifacts/$platform"
mkdir -p "$artifacts"

need() {
  command -v "$1" >/dev/null || {
    echo "missing: $1 ($2)" >&2
    exit 1
  }
}
need agent-device "nix 개발 셸"
need curl "curl"
if [ "$platform" = ios ]; then
  need xcrun "Xcode — e2e/README.md 참고"
  xcrun simctl help >/dev/null 2>&1 || {
    echo "xcrun simctl unavailable: Xcode 의 DEVELOPER_DIR 을 쓰는 셸(#mobile)에서 실행하세요." >&2
    exit 1
  }
else
  need adb "Android SDK — #mobile 셸"
fi

pids=()
cleanup() {
  # pnpm 이 띄운 vite/expo 자식 프로세스까지 끝낸다.
  for pid in ${pids[@]+"${pids[@]}"}; do
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 120); do
    curl -sf -o /dev/null "$url" && return 0
    sleep 1
  done
  echo "$name did not become ready: $url (log: $artifacts/$name.log)" >&2
  exit 1
}

if ! curl -sf -o /dev/null http://localhost:3000/; then
  (cd "$root" && pnpm dev:web) >"$artifacts/web.log" 2>&1 &
  pids+=($!)
fi
if ! curl -sf -o /dev/null http://localhost:8081/status; then
  # CI=1 은 주지 않는다. Metro 가 파일 감시를 꺼서 코드를 고쳐도 반영되지 않는다.
  (cd "$root/apps/ziper-mobile" && pnpm exec expo start --dev-client --port 8081) \
    >"$artifacts/metro.log" 2>&1 &
  pids+=($!)
fi
wait_for http://localhost:3000/ web
wait_for http://localhost:8081/status metro

if [ "$platform" = android ]; then
  # 에뮬레이터 안의 앱이 호스트 Metro 를 localhost:8081 로 찾는다. 웹은 10.0.2.2:3000 이라 필요 없다.
  adb reverse tcp:8081 tcp:8081
  target=(--platform android --serial "$(adb devices | awk '/^emulator-/ { print $1; exit }')")
  # 개발 바이너리(dev client)가 Metro 를 찾을 때 여는 권한 창을 미리 허용한다.
  adb shell pm grant com.ject.ziper android.permission.ACCESS_LOCAL_NETWORK 2>/dev/null || true
else
  # Android AVD 와 이름이 같으므로 --platform 으로 함께 고른다.
  target=(--platform ios --device ziper-e2e)
  agent-device prepare ios-runner "${target[@]}"
fi

cd "$root"
if [ $# -eq 0 ]; then
  set -- "e2e/flows/*.yaml"
  # 하드웨어 Back 처럼 한 플랫폼에만 있는 동작은 플랫폼 폴더에 둔다.
  [ -d "e2e/flows/$platform" ] && set -- "$@" "e2e/flows/$platform/*.yaml"
fi

# 시나리오는 두 플랫폼이 같이 쓰는 Maestro YAML 이다(agent-device 의 Maestro 호환 모드).
agent-device test "$@" --maestro \
  "${target[@]}" \
  --artifacts-dir "$artifacts" \
  --reporter default \
  --reporter "junit:$artifacts/junit.xml"
