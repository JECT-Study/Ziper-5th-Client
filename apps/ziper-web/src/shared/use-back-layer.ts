import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

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
  // Back 을 받았는데 닫을 수 없으면(처리 중 등) 다시 한 칸을 쌓는다.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!open || !history) return;
    const base = history.location.state.__TSR_index;
    history.push(history.location.href);
    const pushed = history.location.state.__TSR_index;
    let popped = false;
    const unsubscribe = history.subscribe(({ location }) => {
      if (location.state.__TSR_index > base) return;
      popped = true;
      unsubscribe();
      onBackRef.current();
      setGeneration((n) => n + 1);
    });
    return () => {
      unsubscribe();
      // 다른 주소로 이동해 닫힌 경우에는 history 를 건드리지 않는다.
      if (!popped && history.location.state.__TSR_index === pushed) history.back();
    };
  }, [open, history, generation]);
}
