import { useEffect, useState } from 'react';

type ImageLoad = { attempt: number; status: 'loading' | 'ready' | 'failed' };

/**
 * Tracks whether the shop image actually renders. A slow or failed image gets one more
 * attempt; the caller remounts the <img> by `attempt` and reports each load with `settle`.
 */
export function useLinkedImage(url: string | null | undefined) {
  const [{ attempt, status }, setLoad] = useState<ImageLoad>({ attempt: 0, status: 'loading' });
  const loading = Boolean(url && status === 'loading');
  function settle(completedAttempt: number, loaded: boolean) {
    setLoad((current) => {
      if (current.attempt !== completedAttempt || current.status !== 'loading') return current;
      if (loaded) return { attempt: completedAttempt, status: 'ready' };
      if (completedAttempt === 0) return { attempt: 1, status: 'loading' };
      return { attempt: completedAttempt, status: 'failed' };
    });
  }
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => settle(attempt, false), 4_000);
    return () => clearTimeout(timer);
  }, [attempt, loading]);
  return { attempt, status, loading, settle };
}
