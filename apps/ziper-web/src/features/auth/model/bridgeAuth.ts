import { BridgeError, providers, type Session, type WebAuthService } from '@ziper/bridge/contract';
import { signInWithSocialToken, signOut } from '../api/authApi';
import { loadTokens, userIdOf } from '../../../shared/api/tokens';
import { isWebLoginConfigured, startWebLogin } from './webOAuth';

// 브릿지는 "일회용 교환 코드"를 웹이 백엔드 세션으로 바꾸는 구조인데, 백엔드에는 그런 API 가 없다.
// 그래서 앱은 교환 코드 자리에 SDK 토큰({ provider, token })을 담아 보내고, 웹이 그 토큰으로 로그인한다.

// 소셜로 처음 가입한 사람은 signupRequired 로 알려서 약관 화면을 거치게 한다.
function signedIn(accessToken: string, isNewUser = false): Session {
  return {
    status: isNewUser ? 'signupRequired' : 'signedIn',
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
      const { accessToken, isNewUser } = await signInWithSocialToken(provider, token);
      return signedIn(accessToken, isNewUser);
    },
    async current() {
      const tokens = loadTokens();
      return tokens ? signedIn(tokens.accessToken) : null;
    },
    // 토큰은 WebView 의 localStorage 에 있다. 앱 쪽에 따로 보관할 것이 없다.
    async nativeHandoff() {
      return { handoffCode: 'web-session' };
    },
    logout: signOut,
  },
};
