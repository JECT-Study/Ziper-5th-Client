import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { waitForRouteExit } from './wait-for-route-exit';

afterEach(() => vi.useRealTimers());

it('waits for the route to change, ignoring a temporary entry on the same route', async () => {
  const history = createMemoryHistory({
    initialEntries: ['/boards/1?sort=PRICE_ASC', '/boards/purchased', '/boards/purchased'],
  });
  const exited = vi.fn();
  const pending = waitForRouteExit(history, () => history.back()).then(exited);
  await Promise.resolve();
  expect(exited).not.toHaveBeenCalled();
  history.back();
  await pending;
  expect(exited).toHaveBeenCalledExactlyOnceWith(true);
  expect(history.location.href).toBe('/boards/1?sort=PRICE_ASC');
});

it('reports an ignored traversal without attempting a second Back', async () => {
  vi.useFakeTimers();
  const history = createMemoryHistory({ initialEntries: ['/boards', '/boards/purchased'] });
  const traverse = vi.fn();
  const pending = waitForRouteExit(history, traverse);
  await vi.advanceTimersByTimeAsync(1_200);
  await expect(pending).resolves.toBe(false);
  expect(traverse).toHaveBeenCalledOnce();
  await expect(waitForRouteExit(history, () => history.back())).resolves.toBe(true);
});
