// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, expect, it } from 'vitest';
import { useBackLayer } from './use-back-layer';

let root: Root | null = null;
let setOpen: (open: boolean) => void = () => {};
let closable = true;
let backs = 0;

function Layer() {
  const [open, set] = useState(false);
  setOpen = set;
  useBackLayer(open, () => {
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
