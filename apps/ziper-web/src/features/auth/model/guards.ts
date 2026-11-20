// 라우트 가드. 토큰이 브라우저 localStorage 에 있어서, 가드를 쓰는 라우트는 ssr: false 로 둔다.
import { redirect, type ParsedLocation } from '@tanstack/react-router';
import { loadTokens } from '../../../shared/api/tokens';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** 가입 흐름에서 넘어왔다는 표시. 가입 직후 화면(약관 동의, 가입 완료)만 이 표시로 들어온다. */
    fromSignup?: boolean;
  }
}

/** 가입 흐름에서 다음 화면으로 넘길 때 navigate 의 state 로 함께 넘긴다. */
export const SIGNUP_FLOW = { fromSignup: true } as const;

const signedIn = () => loadTokens() !== null;

/** 로그인한 사람만 들어온다. 아니면 로그인 화면으로 보낸다. */
export function requireSignedIn() {
  if (!signedIn()) throw redirect({ to: '/login', replace: true });
}

/** 로그인하지 않은 사람만 들어온다(로그인·가입 화면). 이미 로그인했으면 홈으로 보낸다. */
export function requireSignedOut() {
  if (signedIn()) throw redirect({ to: '/', replace: true });
}

/**
 * 가입 직후 화면(약관 동의, 가입 완료). 가입이 끝나 로그인된 상태에서 넘어오므로 로그인은 필요하지만,
 * 주소로 직접 들어오면 홈으로 보낸다. 새로고침은 같은 기록이라 표시가 남아 그대로 있다.
 */
export function requireSignupFlow({ location }: { location: ParsedLocation }) {
  if (!signedIn()) throw redirect({ to: '/login', replace: true });
  if (!location.state.fromSignup) throw redirect({ to: '/', replace: true });
}
