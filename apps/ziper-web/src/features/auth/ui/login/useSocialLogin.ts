import { useEffect, useState } from 'react';
import type { Provider } from '@ziper/bridge/contract';
import { usePlatform } from '../../../../bridge/provider';
import { loadLastProvider, saveLastProvider } from '../../model/lastProvider';

const PROVIDERS: Provider[] = ['naver', 'kakao', 'apple'];

// 애플 로그인은 iOS 앱에서만 보인다. App Store 규칙상 iOS 앱에만 필요하고, 웹·안드로이드에는 SDK 가 없다.
// iPad 의 WebView 는 Mac 으로 보이는 UA 를 쓰므로 터치 지원으로 함께 판단한다.
const isIOSDevice = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * 소셜 로그인 버튼 상태. 앱에서는 네이티브 SDK, 브라우저에서는 인가 코드 방식으로 간다.
 * login 은 결과(signedIn · signupRequired · cancelled)를 돌려주고 실패하면 던진다.
 */
export function useSocialLogin() {
  const { platform, status } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [showApple, setShowApple] = useState(false);
  const [lastProvider, setLastProvider] = useState<Provider | null>(null);

  useEffect(() => setLastProvider(loadLastProvider()), []);

  useEffect(() => setShowApple(status === 'native' && isIOSDevice()), [status]);

  // 브라우저 로그인은 페이지를 떠나므로, 뒤로 가기로 되살아난 페이지에는 로딩이 켜진 채 남아 있다.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function login(provider: Provider) {
    setBusy(true);
    try {
      const result = await platform.auth.login(provider);
      if (result.status !== 'cancelled') saveLastProvider(provider);
      return result.status;
    } finally {
      setBusy(false);
    }
  }

  return {
    providers: PROVIDERS.filter((provider) => provider !== 'apple' || showApple),
    lastProvider,
    busy,
    login,
  };
}
