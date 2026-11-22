import { expoShareWakeURL } from '../share/inbox';

// 앱으로 들어오는 주소를 라우터가 화면으로 열기 전에 거른다.
// 네이버·카카오 SDK 는 로그인 결과를 앱 주소로 돌려주는데, 이 주소는 SDK 가 네이티브에서 처리한다.
// 라우터가 화면으로 열려고 하면 "Unmatched Route" 가 뜨므로 무시한다(null 이면 지금 화면에 머문다).
const SDK_CALLBACKS = [/thirdPartyLoginResult/, /^kakao[0-9a-f]+:\/\/oauth/];

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // The URL is just Expo's wake-up signal. Warm shares keep the current native screen.
  if (path === expoShareWakeURL) return initial ? '/' : null;
  try {
    if (SDK_CALLBACKS.some((pattern) => pattern.test(path))) return null;
  } catch {
    // 여기서 던지면 앱이 죽으므로 원래 주소로 보낸다.
  }
  return path;
}
