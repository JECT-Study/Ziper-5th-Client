// 일반 브라우저의 소셜 로그인(인가 코드 방식).
// 프로바이더 로그인 페이지로 보냈다가 /auth/callback/{provider} 로 돌아오면, 받은 코드를 백엔드가 토큰으로 바꾼다.
// 앱 안에서는 네이티브 SDK 를 쓰므로 이 흐름을 타지 않는다. 애플은 iOS 앱에서만 쓰므로 웹에는 없다.
import type { Provider } from '@ziper/bridge/contract';

type WebProvider = Exclude<Provider, 'apple'>;

const CLIENT_IDS: Record<WebProvider, string | undefined> = {
  kakao: import.meta.env.VITE_KAKAO_REST_API_KEY,
  naver: import.meta.env.VITE_NAVER_CLIENT_ID,
};

const AUTHORIZE_URLS: Record<WebProvider, string> = {
  kakao: 'https://kauth.kakao.com/oauth/authorize',
  naver: 'https://nid.naver.com/oauth2.0/authorize',
};

const isWebProvider = (provider: Provider): provider is WebProvider => provider !== 'apple';

const STATE_KEY = 'ziper:oauthState';

export const redirectUriOf = (provider: Provider) =>
  `${window.location.origin}/auth/callback/${provider}`;

export const isWebLoginConfigured = (provider: Provider) =>
  isWebProvider(provider) && Boolean(CLIENT_IDS[provider]);

/** 프로바이더 로그인 페이지로 이동한다. 페이지를 떠나므로 돌아오지 않는다. */
export function startWebLogin(provider: WebProvider) {
  const state = crypto.getRandomValues(new Uint32Array(4)).join('');
  sessionStorage.setItem(STATE_KEY, `${provider}:${state}`);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_IDS[provider] ?? '',
    redirect_uri: redirectUriOf(provider),
    state,
  });
  window.location.assign(`${AUTHORIZE_URLS[provider]}?${params}`);
}

/** 콜백으로 돌아온 state 가 이 브라우저에서 시작한 로그인인지 확인한다(CSRF 방지). */
export function consumeState(provider: Provider, state: string | null): boolean {
  const saved = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return state !== null && saved === `${provider}:${state}`;
}
