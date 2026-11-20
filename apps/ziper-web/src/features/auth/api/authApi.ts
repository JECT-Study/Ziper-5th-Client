// 인증 관련 백엔드 API. 화면·상태는 모르고 요청과 응답만 다룬다.
import { ApiError, request } from '../../../shared/api/http';
import { clearTokens, loadTokens, saveTokens, type Tokens } from '../../../shared/api/tokens';

// 로그인·가입 API 는 토큰을 응답 본문으로 준다. 받으면 바로 저장한다.
async function signIn(path: string, body: unknown) {
  const result = await request<Tokens & { isNewUser?: boolean }>(path, { method: 'POST', body });
  saveTokens(result);
  return { isNewUser: Boolean(result.isNewUser), accessToken: result.accessToken };
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

/** 이 기기의 토큰을 먼저 지우고, 백엔드 세션도 끊는다. */
export async function signOut() {
  const tokens = loadTokens();
  clearTokens();
  if (tokens)
    await request('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
    });
}
