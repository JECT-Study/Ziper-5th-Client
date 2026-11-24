// 인증 관련 백엔드 API. 화면·상태는 모르고 요청과 응답만 다룬다.
import { ApiError, request, startSession } from '../../../shared/api/http';
import { clearPendingSignup, savePendingSignup } from '../model/pendingSignup';

// 로그인·가입 API 는 Refresh Token 을 HttpOnly 쿠키로, Access Token 은 본문으로 준다.
async function signIn(path: string, body: unknown) {
  const { accessToken } = await request<{ accessToken: string }>(path, {
    method: 'POST',
    body,
    session: true,
  });
  startSession(accessToken);
  return accessToken;
}

/** 소셜 로그인 결과. 처음 온 사람은 아직 회원이 아니라서, 약관 동의 후 가입할 때 쓸 가입 토큰(10분)만 받는다. */
export type SocialLoginResult =
  | { status: 'signedIn'; accessToken: string }
  | { status: 'signupRequired'; signupToken: string };

async function socialSignIn(path: string, body: unknown): Promise<SocialLoginResult> {
  const result = await request<
    | { authType: 'LOGIN'; accessToken: string }
    | { authType: 'SIGNUP_REQUIRED'; signupToken: string }
  >(path, { method: 'POST', body, session: true });
  if (result.authType === 'SIGNUP_REQUIRED') {
    savePendingSignup(result.signupToken);
    return { status: 'signupRequired', signupToken: result.signupToken };
  }
  startSession(result.accessToken);
  return { status: 'signedIn', accessToken: result.accessToken };
}

export async function isNicknameAvailable(nickname: string): Promise<boolean> {
  const { available } = await request<{ available: boolean }>(
    `/api/v1/users/nickname/availability?nickname=${encodeURIComponent(nickname)}`,
  );
  return available;
}

/** 인증번호를 보내고, 이후 확인·가입에 쓸 흐름 ID 를 돌려준다. */
export async function sendEmailCode(email: string): Promise<string> {
  const { flowId } = await request<{ flowId: string }>('/api/v1/auth/email/verifications', {
    method: 'POST',
    body: { email },
  });
  return flowId;
}

export function resendEmailCode(flowId: string) {
  return request(`/api/v1/auth/email/verifications/${flowId}/resend`, { method: 'POST' });
}

export type VerifyResult = 'verified' | 'mismatch' | 'locked';

export async function verifyEmailCode(flowId: string, code: string): Promise<VerifyResult> {
  try {
    await request(`/api/v1/auth/email/verifications/${flowId}/verify`, {
      method: 'POST',
      body: { code },
    });
    return 'verified';
  } catch (error) {
    if (!(error instanceof ApiError) || error.status >= 500) throw error;
  }
  // 틀린 이유(오입력·잠김)는 상태 조회로 구분한다. 서버는 5회 넘게 틀리면 잠근다.
  const status = await request<{ remainingAttempts: number; lockedUntil: string | null }>(
    `/api/v1/auth/email/verifications/${flowId}`,
  );
  return status.lockedUntil !== null || status.remainingAttempts <= 0 ? 'locked' : 'mismatch';
}

export async function signUp(input: {
  flowId: string;
  nickname: string;
  password: string;
  marketingAgreed: boolean;
}): Promise<void> {
  await signIn('/api/v1/auth/email/signup', {
    flowId: input.flowId,
    nickname: input.nickname,
    password: input.password,
    agreements: { termsOfService: true, privacyPolicy: true, marketing: input.marketingAgreed },
  });
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signIn('/api/v1/auth/email/login', { email, password });
}

/** 앱 SDK 가 받은 토큰(Apple 은 ID Token, 카카오·네이버는 Access Token)으로 로그인한다. */
export function signInWithSocialToken(provider: string, token: string) {
  return socialSignIn(`/api/v1/auth/oauth/${provider}`, { token });
}

/** 웹 로그인으로 받은 인가 코드를 백엔드가 프로바이더 토큰으로 바꿔 로그인한다. */
export function signInWithOAuthCode(
  provider: string,
  input: { code: string; redirectUri: string; state: string },
) {
  return socialSignIn(`/api/v1/auth/oauth/${provider}/code`, input);
}

/** 소셜 신규 가입자가 약관에 동의하면 이때 회원이 만들어지고 로그인된다. */
export async function signUpWithSocial(signupToken: string, marketingAgreed: boolean) {
  await signIn('/api/v1/auth/oauth/signup', {
    signupToken,
    agreements: { termsOfService: true, privacyPolicy: true, marketing: marketingAgreed },
  });
  clearPendingSignup();
}

/** 이 기기의 세션을 먼저 지우고, 백엔드 세션과 쿠키도 끊는다. */
export async function signOut() {
  startSession(null);
  await request('/api/v1/auth/logout', { method: 'POST', session: true });
}
