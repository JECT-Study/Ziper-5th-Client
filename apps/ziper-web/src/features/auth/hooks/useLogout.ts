import { useState } from 'react';
import { usePlatform } from '../../../bridge/provider';

/**
 * 로그아웃. 웹 서버가 쿠키를 지우고, 앱이면 브릿지가 SDK 세션도 끊는다.
 * 백엔드가 실패해도 이 기기의 로그인은 이미 끝났으므로 던지지 않는다. 이동은 쓰는 쪽이 정한다.
 */
export function useLogout() {
  const { platform } = usePlatform();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await platform.auth.logout().catch((error) => console.error('로그아웃 중 오류', error));
    setPending(false);
  }

  return { logout, pending };
}
