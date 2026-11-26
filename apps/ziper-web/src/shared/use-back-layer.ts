import { useRouter, type RouterHistory } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { waitForHistory } from './wait-for-route-exit';

// A retry can tell an orphaned sheet entry from the detail it needs to replace.
declare module '@tanstack/react-router' {
  interface HistoryState {
    ziperLayer?: true;
  }
}

/** Retry a timed-out layer pop before replacing its base route. */
export async function discardStaleBackLayer(history: RouterHistory) {
  const { href, state } = history.location;
  if (!state.ziperLayer) return true;
  await waitForHistory(
    history,
    () => history.back(),
    (location) => location.href !== href || !location.state.ziperLayer,
  );
  const target = history.location;
  return (
    target.href === href &&
    !target.state.ziperLayer &&
    target.state.__TSR_index === state.__TSR_index - 1
  );
}

/**
 * 주소는 그대로 두고 화면 안에서만 바뀌는 단계(수정·결과 화면, 확인 창)를 history 한 칸으로 만든다.
 * 앱은 웹 history 가 있으면 하드웨어 Back 을 웹으로 넘기므로(bridge.md 의 Back 순서) Back 이 이 단계를 먼저 닫는다.
 * 브라우저 뒤로 가기도 같다. Back 이 오면 onBack 으로 한 단계 닫고, UI 로 닫히면 쌓아 둔 칸을 되돌린다.
 */
export function useBackLayer(open: boolean, onBack: () => void) {
  // 라우터 밖(컴포넌트 단위 테스트)에서는 아무것도 하지 않는다.
  const history = useRouter({ warn: false })?.history;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const discard = useRef<(() => Promise<boolean>) | null>(null);
  // Back 을 받았는데 닫을 수 없으면(처리 중 등) 다시 한 칸을 쌓는다.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!open || !history) return;
    const { href, state } = history.location;
    const base = state.__TSR_index;
    history.push(href, { ...state, ziperLayer: true });
    const pushed = history.location.state.__TSR_index;
    let popped = false;
    let discardRequest: Promise<boolean> | undefined;
    let settleDiscard: ((atBase: boolean) => void) | undefined;
    const unsubscribe = history.subscribe(({ location }) => {
      const samePage = location.href === href;
      const index = location.state.__TSR_index;
      if (index > base && !(discardRequest && !samePage)) return;
      popped = true;
      unsubscribe();
      if (discardRequest) settleDiscard?.(samePage && index === base);
      else if (samePage) {
        onBackRef.current();
        setGeneration((n) => n + 1);
      }
    });
    discard.current = () => {
      const { href: currentHref, state: current } = history.location;
      if (currentHref !== href || current.__TSR_index !== pushed) {
        return Promise.resolve(popped && currentHref === href && current.__TSR_index === base);
      }
      if (discardRequest) return discardRequest;
      discardRequest = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => settleDiscard?.(false), 1_200);
        settleDiscard = (atBase) => {
          clearTimeout(timer);
          settleDiscard = undefined;
          resolve(atBase);
        };
      });
      try {
        history.back();
      } catch {
        settleDiscard?.(false);
      }
      return discardRequest;
    };
    return () => {
      discard.current = null;
      settleDiscard?.(false);
      unsubscribe();
      // Never issue a second Back while the first one may still arrive.
      if (
        !discardRequest &&
        !popped &&
        history.location.href === href &&
        history.location.state.__TSR_index === pushed
      ) {
        history.back();
      }
    };
  }, [open, history, generation]);

  // A rejected navigation must restore the entry if the original sheet is still open.
  return (navigate?: () => Promise<unknown>) => {
    const active = discard.current;
    const href = history?.location.href;
    const result = active?.() ?? Promise.resolve(true);
    if (!navigate) return result;
    return result.then(async (atBase) => {
      const base = history?.location;
      if (!atBase || active !== discard.current || base?.href !== href) return false;
      try {
        await navigate();
        return true;
      } catch (error) {
        if (active && active === discard.current && history?.location === base) {
          setGeneration((n) => n + 1);
        }
        throw error;
      }
    });
  };
}
