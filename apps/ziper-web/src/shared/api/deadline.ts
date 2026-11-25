/**
 * A request budget linked to the caller's signal. The returned signal aborts with the caller's
 * reason, or with a plain AbortError when the budget runs out. Always dispose it.
 */
export type Deadline = {
  readonly signal: AbortSignal;
  /** Whether the budget, not the caller, aborted the signal. */
  readonly expired: boolean;
  readonly paused: boolean;
  /** Stops the clock until the returned resume runs. Undefined if paused or already spent. */
  pause(): (() => void) | undefined;
  dispose(): void;
};

export function withDeadline(parent: AbortSignal, ms: number): Deadline {
  parent.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(parent.reason);
  parent.addEventListener('abort', cancel, { once: true });
  let expired = false;
  let paused = false;
  const endsAt = performance.now() + ms;
  const start = (remaining: number) =>
    setTimeout(() => {
      expired = true;
      controller.abort();
    }, remaining);
  let timer = start(ms);
  return {
    signal: controller.signal,
    get expired() {
      return expired;
    },
    get paused() {
      return paused;
    },
    pause() {
      const remaining = endsAt - performance.now();
      if (paused || remaining <= 0) return;
      paused = true;
      clearTimeout(timer);
      return () => {
        timer = start(remaining);
      };
    },
    dispose() {
      clearTimeout(timer);
      parent.removeEventListener('abort', cancel);
    },
  };
}

/** A gateway failure that a read-only request may retry once, unless the server set a pace. */
export function isGatewayFailure(response: Response) {
  return (
    (response.status === 502 || response.status === 504) && !response.headers.has('Retry-After')
  );
}
