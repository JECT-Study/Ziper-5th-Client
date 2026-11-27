import type { AnyRouter } from '@tanstack/react-router';
import type { WebNavigation } from '@ziper/bridge/contract';

// 여기에 오면 그 앞 기록(로그인·약관·가입 폼)으로는 돌아가지 않는다.
// 웹은 history 를 지울 수 없어서, 앱에 알려 주는 깊이(depth)를 이 화면부터 다시 센다.
// 깊이가 0 이면 앱이 스와이프·뒤로 가기를 웹 기록으로 넘기지 않는다(ziper-mobile web-screen).
const HISTORY_ROOTS = new Set(['/signup/complete']);

export function createWebNavigation(router: AnyRouter): WebNavigation {
  let floor = 0;
  return {
    async push(path) {
      await router.navigate({ to: path });
    },
    async replace(path) {
      await router.navigate({ to: path, replace: true });
    },
    async back() {
      router.history.back();
    },
    depth() {
      const { pathname, state } = router.history.location;
      const index = Math.max(0, state.__TSR_index ?? 0);
      if (HISTORY_ROOTS.has(pathname)) floor = index;
      return Math.max(0, index - floor);
    },
  };
}
