import { BridgeError, providers, type Session, type WebAuthService } from '@ziper/bridge/contract';
import { signInWithSocialToken, signOut } from '../api/authApi';
import { ensureSession } from '../../../shared/api/http';
import { getAccessToken, userIdOf } from '../../../shared/api/session';
import { isWebLoginConfigured, startWebLogin } from './webOAuth';

// 브릿지는 "일회용 교환 코드"를 웹이 백엔드 세션으로 바꾸는 구조인데, 백엔드에는 그런 API 가 없다.
// 그래서 앱은 교환 코드 자리에 SDK 토큰({ provider, token })을 담아 보내고, 웹이 그 토큰으로 로그인한다.

function signedIn(accessToken: string): Session {
  return {
    status: 'signedIn',
    profile: { id: userIdOf(accessToken) ?? 'unknown', displayName: null },
  };
}

function parseHandoff(code: string): { provider: string; token: string } {
  try {
    const value = JSON.parse(code) as { provider?: unknown; token?: unknown };
    if (
      typeof value.provider === 'string' &&
      (providers as readonly string[]).includes(value.provider) &&
      typeof value.token === 'string' &&
      value.token.length > 0
    )
      return { provider: value.provider, token: value.token };
  } catch {
    // 아래에서 실패로 처리한다.
  }
  throw new BridgeError('AUTH_FAILED');
}

export const webAuth: WebAuthService = {
  // 일반 브라우저는 인가 코드 방식으로 간다.
  // 페이지를 떠나므로 결과는 /auth/callback/{provider} 화면에서 이어진다.
  login({ provider }) {
    if (provider === 'apple' || !isWebLoginConfigured(provider))
      return Promise.reject(new BridgeError('UNSUPPORTED'));
    startWebLogin(provider);
    return new Promise(() => {});
  },
  session: {
    async createTransaction() {
      return { transactionId: crypto.getRandomValues(new Uint32Array(4)).join('-') };
    },
    async exchange({ handoffCode }) {
      const { provider, token } = parseHandoff(handoffCode);
      const result = await signInWithSocialToken(provider, token);
      // 처음 온 사람은 아직 회원이 아니다. signupRequired 로 알려서 약관 화면을 거치게 한다.
      if (result.status === 'signupRequired') return { status: 'signupRequired', profile: null };
      return signedIn(result.accessToken);
    },
    async current() {
      if (!(await ensureSession())) return null;
      const accessToken = getAccessToken();
      return accessToken ? signedIn(accessToken) : null;
    },
    // 세션은 WebView 의 쿠키(Refresh)와 메모리(Access)에 있다. 앱 쪽에 따로 보관할 것이 없다.
    async nativeHandoff() {
      return { handoffCode: 'web-session' };
    },
    logout: signOut,
  },
};
