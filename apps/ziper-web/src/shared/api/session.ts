// 로그인 세션. Refresh Token 은 백엔드가 HttpOnly 쿠키로 들고 있어서 스크립트가 볼 수 없다.
// Access Token 만 메모리에 두고, 새로고침하면 재발급으로 다시 받는다.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Access Token 의 회원 ID(sub). 프로필 API 가 없어서 토큰에서 꺼낸다. */
export function userIdOf(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = (JSON.parse(atob(payload)) as { sub?: unknown }).sub;
    return sub == null ? null : String(sub);
  } catch {
    return null;
  }
}
