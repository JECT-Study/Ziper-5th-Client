// 라우트 가드. 세션은 브라우저에서만 확인할 수 있어서(쿠키 재발급), 가드를 쓰는 라우트는 ssr: false 로 둔다.
import { redirect, type ParsedLocation } from '@tanstack/react-router';
import { ensureSession } from '../../../shared/api/http';
import { loadPendingSignup } from './pendingSignup';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** 가입 흐름에서 넘어왔다는 표시. 가입 완료 화면은 이 표시로만 들어온다. */
    fromSignup?: boolean;
  }
}

/** 가입 흐름에서 다음 화면으로 넘길 때 navigate 의 state 로 함께 넘긴다. */
export const SIGNUP_FLOW = { fromSignup: true } as const;

/** 로그인한 사람만 들어온다. 아니면 로그인 화면으로 보낸다. */
export async function requireSignedIn() {
  if (!(await ensureSession())) throw redirect({ to: '/login', replace: true });
}

/** 로그인하지 않은 사람만 들어온다(로그인·가입 화면). 이미 로그인했으면 홈으로 보낸다. */
export async function requireSignedOut() {
  if (await ensureSession()) throw redirect({ to: '/', replace: true });
}

/**
 * 소셜 신규 가입자의 약관 동의 화면. 아직 회원이 아니고, 소셜 로그인에서 받은 가입 토큰이 있어야 들어온다.
 * 동의하지 않고 나가면 회원이 만들어지지 않으므로, 다음에 로그인하면 다시 이 화면으로 온다.
 */
export async function requireSocialSignup() {
  if (await ensureSession()) throw redirect({ to: '/', replace: true });
  if (!loadPendingSignup()) throw redirect({ to: '/login', replace: true });
}

/** 가입 완료 화면. 가입이 끝나 로그인된 상태에서만 오고, 주소로 직접 들어오면 홈으로 보낸다. */
export async function requireSignupFlow({ location }: { location: ParsedLocation }) {
  if (!(await ensureSession())) throw redirect({ to: '/login', replace: true });
  if (!location.state.fromSignup) throw redirect({ to: '/', replace: true });
}
