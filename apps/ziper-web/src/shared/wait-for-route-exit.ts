import type { HistoryLocation, RouterHistory } from '@tanstack/react-router';

export function waitForRouteExit(history: RouterHistory, traverse: () => void) {
  const { pathname } = history.location;
  // A same-path pop only dismisses a sheet; it doesn't leave the route.
  return waitForHistory(history, traverse, (location) => location.pathname !== pathname);
}

/** A history traversal returns before the browser/WebView reports the destination. */
export function waitForHistory(
  history: RouterHistory,
  traverse: () => void,
  reached: (location: HistoryLocation) => boolean,
) {
  return new Promise<boolean>((resolve) => {
    const complete = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve(reached(history.location));
    };
    const unsubscribe = history.subscribe(({ location }) => {
      if (reached(location)) complete();
    });
    const timer = setTimeout(complete, 1_200);
    try {
      traverse();
    } catch {
      complete();
    }
  });
}
