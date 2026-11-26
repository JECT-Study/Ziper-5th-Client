// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { discardStaleBackLayer, useBackLayer } from './use-back-layer';

let root: Root | null = null;
let setOpen: (open: boolean) => void = () => {};
let discardLayer: ReturnType<typeof useBackLayer>;
let closable = true;
let backs = 0;

function Layer() {
  const [open, set] = useState(false);
  setOpen = set;
  discardLayer = useBackLayer(open, () => {
    backs += 1;
    if (closable) set(false);
  });
  return <p>{open ? 'open' : 'closed'}</p>;
}

async function setup() {
  const router = createRouter({
    routeTree: createRootRoute({ component: Layer }),
    history: createMemoryHistory({ initialEntries: ['/products/1?preview=normal'] }),
  });
  const element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  await act(async () => root!.render(<RouterProvider router={router} />));
  return { router, index: () => router.history.location.state.__TSR_index, element };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  closable = true;
  backs = 0;
  document.body.innerHTML = '';
});

it('adds one history entry while open and closes on Back without changing the address', async () => {
  const { router, index, element } = await setup();
  const base = index();
  await act(async () => setOpen(true));
  expect(index()).toBe(base + 1);
  expect(router.history.location.state.ziperLayer).toBe(true);
  expect(router.history.location.href).toBe('/products/1?preview=normal');

  await act(async () => router.history.back());
  expect(backs).toBe(1);
  expect(element.textContent).toBe('closed');
  expect(index()).toBe(base);
});

it('removes its entry when the screen closes the layer itself', async () => {
  const { index } = await setup();
  const base = index();
  await act(async () => setOpen(true));
  await act(async () => setOpen(false));
  expect(index()).toBe(base);
});

it('discards the confirmation entry so replacing the screen leaves the preceding route intact', async () => {
  const { router, index } = await setup();
  await act(async () => router.history.push('/products/7'));
  await act(async () => setOpen(true));
  await act(async () => {
    expect(await discardLayer()).toBe(true);
    expect(backs).toBe(0);
    router.history.replace('/boards/purchased');
    setOpen(false);
  });
  expect(index()).toBe(1);
  await act(async () => router.history.back());
  expect(router.history.location.href).toBe('/products/1?preview=normal');
});

it('releases callers if WebView ignores Back, without trying a second traversal on cleanup', async () => {
  const { router } = await setup();
  const back = vi.spyOn(router.history, 'back').mockImplementation(() => {});
  vi.useFakeTimers();
  try {
    await act(async () => setOpen(true));
    const first = discardLayer();
    expect(discardLayer()).toBe(first);
    await vi.advanceTimersByTimeAsync(1_200);
    await expect(first).resolves.toBe(false);
    await act(async () => setOpen(false));
    expect(back).toHaveBeenCalledOnce();
    expect(backs).toBe(0);
  } finally {
    back.mockRestore();
    vi.useRealTimers();
  }
});

it('retries a timed-out purchase confirmation without leaving detail behind the list', async () => {
  const history = createMemoryHistory({
    initialEntries: ['/boards/1?sort=PRICE_ASC', '/products/7'],
  });
  expect(await discardStaleBackLayer(history)).toBe(true);
  expect(history.location.pathname).toBe('/products/7');
  history.push('/products/7', { ziperLayer: true });
  const back = vi.spyOn(history, 'back').mockImplementationOnce(() => {});
  vi.useFakeTimers();
  try {
    const pending = discardStaleBackLayer(history);
    await vi.advanceTimersByTimeAsync(1_200);
    expect(await pending).toBe(false);
    expect(back).toHaveBeenCalledOnce();
    expect(history.location.state.ziperLayer).toBe(true);
    expect(await discardStaleBackLayer(history)).toBe(true);
    history.replace('/boards/purchased');
    history.back();
    expect(history.location.href).toBe('/boards/1?sort=PRICE_ASC');
  } finally {
    back.mockRestore();
    vi.useRealTimers();
  }
});

it('does not replace a different route when a stale layer pop overshoots', async () => {
  const history = createMemoryHistory({ initialEntries: ['/boards/1', '/products/7'] });
  history.push('/products/7', { ziperLayer: true });
  const back = vi.spyOn(history, 'back').mockImplementationOnce(() => history.go(-2));
  try {
    expect(await discardStaleBackLayer(history)).toBe(false);
    expect(history.location.pathname).toBe('/boards/1');
  } finally {
    back.mockRestore();
  }
});

it('can retry navigation after an earlier Back arrives after the discard deadline', async () => {
  const { router } = await setup();
  const back = vi.spyOn(router.history, 'back').mockImplementation(() => {});
  vi.useFakeTimers();
  try {
    await act(async () => setOpen(true));
    const timedOut = discardLayer();
    await vi.advanceTimersByTimeAsync(1_200);
    await expect(timedOut).resolves.toBe(false);
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
    await act(async () => router.history.back());
    await expect(discardLayer()).resolves.toBe(true);
    expect(backs).toBe(0);
  } finally {
    back.mockRestore();
    vi.useRealTimers();
  }
});

it('releases a pending discard when a different route takes over', async () => {
  const { router } = await setup();
  const back = vi.spyOn(router.history, 'back').mockImplementation(() => {});
  try {
    await act(async () => setOpen(true));
    const result = discardLayer();
    await act(async () => router.history.push('/boards/1'));
    await expect(result).resolves.toBe(false);
    await act(async () => setOpen(false));
    expect(router.history.location.pathname).toBe('/boards/1');
    expect(back).toHaveBeenCalledOnce();
  } finally {
    back.mockRestore();
  }
});

it('does not pop a new route that replaces the confirmation entry', async () => {
  const { router, index } = await setup();
  const base = index();
  await act(async () => setOpen(true));
  await act(async () => {
    router.history.replace('/boards/purchased');
    setOpen(false);
  });
  expect(index()).toBe(base + 1);
  expect(router.history.location.pathname).toBe('/boards/purchased');
});

it('keeps an entry when Back arrives but the layer cannot close yet', async () => {
  const { router, index, element } = await setup();
  const base = index();
  closable = false;
  await act(async () => setOpen(true));
  await act(async () => router.history.back());
  expect(backs).toBe(1);
  expect(element.textContent).toBe('open');
  expect(index()).toBe(base + 1);
});
