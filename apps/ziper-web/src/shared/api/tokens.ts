// 로그인 토큰 보관. 백엔드가 아직 토큰을 응답 본문으로만 줘서 localStorage 에 둔다.
// TODO(백엔드): 토큰을 HttpOnly 쿠키로 내려주면 이 파일을 지우고 쿠키로 바꾼다.
const KEY = 'ziper:tokens';

export type Tokens = { accessToken: string; refreshToken: string };

export function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export const saveTokens = ({ accessToken, refreshToken }: Tokens) =>
  localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken }));

export const clearTokens = () => localStorage.removeItem(KEY);

/** Access Token 의 회원 ID(sub). 프로필 API 가 없어서 토큰에서 꺼낸다. */
export function userIdOf(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = (JSON.parse(atob(payload)) as { sub?: unknown }).sub;
    return sub == null ? null : String(sub);
  } catch {
    return null;
  }
}
