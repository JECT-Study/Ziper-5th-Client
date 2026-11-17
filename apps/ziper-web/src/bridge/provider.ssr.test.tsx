import { renderToString } from 'react-dom/server';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { expect, it } from 'vitest';
import { BridgeProvider, usePlatform } from './provider';

function Status() {
  return <span>{usePlatform().status}</span>;
}
it('renders a stable initializing server snapshot without constructing a window client', async () => {
  expect(typeof window).toBe('undefined');
  const renderRequest = async () => {
    const parent = createRootRoute({
      component: () => (
        <BridgeProvider>
          <Status />
          <Outlet />
        </BridgeProvider>
      ),
    });
    const index = createRoute({
      getParentRoute: () => parent,
      path: '/',
      component: () => <p>Starter</p>,
    });
    const router = createRouter({
      routeTree: parent.addChildren([index]),
      history: createMemoryHistory(),
    });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  };
  const [first, second] = await Promise.all([renderRequest(), renderRequest()]);
  expect(first).toContain('initializing');
  expect(second).toEqual(first);
  expect(first).not.toContain('dialog');
});
