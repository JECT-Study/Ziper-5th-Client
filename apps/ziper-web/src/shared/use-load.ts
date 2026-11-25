import { useCallback, useEffect, useState, type DependencyList } from 'react';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: unknown };

type Options<T> = {
  /** Gives up and reports an error after this long. The request is aborted. */
  timeoutMs?: number;
  /** Runs with the value before it is shown, only for the latest request. */
  onReady?: (value: T) => void;
};

/**
 * Loads data for a component, aborting the request when deps change or the component unmounts.
 * Returns the state, a retry that shows loading again, and an updater for local edits.
 */
export function useLoad<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  { timeoutMs, onReady }: Options<T> = {},
) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    const { signal } = request;
    setState((current) => (current.status === 'loading' ? current : { status: 'loading' }));
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            request.abort();
            setState({ status: 'error', error: signal.reason });
          }, timeoutMs);
    load(signal).then(
      (value) => {
        if (signal.aborted) return;
        clearTimeout(timer);
        onReady?.(value);
        setState({ status: 'ready', value });
      },
      (error: unknown) => {
        if (signal.aborted) return;
        clearTimeout(timer);
        setState({ status: 'error', error });
      },
    );
    return () => {
      clearTimeout(timer);
      request.abort();
    };
    // The caller's deps describe `load`; callbacks are read from the render that started it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const update = useCallback(
    (change: (value: T) => T) =>
      setState((current) =>
        current.status === 'ready' ? { status: 'ready', value: change(current.value) } : current,
      ),
    [],
  );
  return [state, retry, update] as const;
}
