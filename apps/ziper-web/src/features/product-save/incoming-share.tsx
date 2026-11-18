import { useRouterState } from '@tanstack/react-router';
import { incomingShareEvent, type IncomingShare } from '@ziper/bridge/contract';
import { useEffect, useRef, useState } from 'react';
import { usePlatform } from '../../bridge/provider';

export function useIncomingShare({ keepFirst = false } = {}) {
  const { platform, status } = usePlatform();
  const [share, setShare] = useState<IncomingShare | null | undefined>();

  useEffect(() => {
    if (status !== 'native') return;
    let sequence = 0;
    const refresh = () => {
      const current = ++sequence;
      void platform.incomingShare.read().then(
        (next) => {
          if (current === sequence) setShare((prev) => (keepFirst && prev ? prev : next));
        },
        () => {
          // An inactive WebView is denied; the native host wakes it again when focused.
        },
      );
    };
    window.addEventListener(incomingShareEvent, refresh);
    refresh();
    return () => {
      sequence++;
      window.removeEventListener(incomingShareEvent, refresh);
    };
  }, [keepFirst, platform, status]);

  return share;
}

export function ShareEntry() {
  const isSaveScreen = useRouterState({
    select: (state) => state.location.pathname === '/share-product',
  });
  return isSaveScreen ? null : <OpenIncomingShare />;
}

function OpenIncomingShare() {
  const { platform } = usePlatform();
  const share = useIncomingShare();
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (!share || attempted.current === share.id) return;
    attempted.current = share.id;
    void platform.navigation.push('/share-product').catch(() => {
      if (attempted.current === share.id) attempted.current = null;
    });
  }, [platform, share]);
  return null;
}
