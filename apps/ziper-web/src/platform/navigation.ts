import type { AnyRouter } from '@tanstack/react-router';
import type { WebNavigation } from '@ziper/bridge/contract';

export function createWebNavigation(router: AnyRouter): WebNavigation {
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
      return Math.max(0, router.history.location.state.__TSR_index ?? 0);
    },
  };
}
