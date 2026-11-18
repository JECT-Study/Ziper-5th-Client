// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { capability, methods, success } from '@ziper/bridge/contract';
import { BridgeProvider, usePlatform } from './provider';
import { createWebNavigation } from '../platform/navigation';

type Emitter = { emit(event: string, ...args: unknown[]): void };

const nativeWindow = window as Window & {
  ReactNativeWebView?: { postMessage(raw: string): void };
  __bridgeMethods__?: string[];
  nativeEmitterMap?: Record<string, Emitter>;
  nativeEmitter?: Emitter;
};

let root: Root | undefined;

let captured: ReturnType<typeof usePlatform>;

const errors: unknown[] = [];

const config = { onError: (error: unknown) => errors.push(error) };

function Capture() {
  captured = usePlatform();
  return <Outlet />;
}

function setup(browser = false) {
  const parent = createRootRoute({
    component: () => (
      <BridgeProvider config={config}>
        <Capture />
      </BridgeProvider>
    ),
  });
  const index = createRoute({
    getParentRoute: () => parent,
    path: '/',
    component: () => <p>Home</p>,
  });
  const next = createRoute({
    getParentRoute: () => parent,
    path: '/next',
    component: () => <p>Next</p>,
  });
  return createRouter({
    routeTree: parent.addChildren([index, next]),
    history: browser ? createBrowserHistory() : createMemoryHistory(),
  });
}

function host() {
  const calls: { method: string; args: unknown[] }[] = [];
  nativeWindow.__bridgeMethods__ = Object.keys(methods);
  nativeWindow.ReactNativeWebView = {
    postMessage(raw) {
      const message = JSON.parse(raw);
      if (message.type !== 'bridge') return;
      const { method, args, eventId } = message.body;
      calls.push({ method, args });
      queueMicrotask(() =>
        nativeWindow.nativeEmitterMap?.[message.bridgeId]?.emit(
          `${method}-${eventId}`,
          success(
            method === 'getBridgeInfoV1'
              ? {
                  protocolVersion: 1,
                  appVersion: '1',
                  platform: 'ios',
                  methods: Object.keys(methods),
                  capabilities: [capability.history],
                }
              : { done: true },
          ),
        ),
      );
    },
  };
  return calls;
}
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
  document.body.replaceChildren();
  delete nativeWindow.ReactNativeWebView;
  delete nativeWindow.__bridgeMethods__;
  delete nativeWindow.nativeEmitter;
  delete nativeWindow.nativeEmitterMap;
  errors.splice(0);
});
async function mount(router: ReturnType<typeof setup>) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
  await vi.waitFor(() => expect(captured?.status).toBe('native'));
}

it('keeps root runtime and retained callbacks alive across real TanStack route navigation', async () => {
  const calls = host();
  const router = setup();
  await mount(router);
  const facade = captured.platform;
  expect(Object.keys(facade).sort()).toEqual(['auth', 'incomingShare', 'navigation', 'sheets']);
  expect(await facade.incomingShare.read()).toBeNull();
  const initialized = calls.filter((call) => call.method === 'getBridgeInfoV1').length;
  const emitters = Object.keys(nativeWindow.nativeEmitterMap!);
  await act(async () => {
    await facade.navigation.push('/next');
  });
  expect(router.state.location.pathname).toBe('/next');
  expect(captured.platform).toBe(facade);
  expect(Object.keys(nativeWindow.nativeEmitterMap!)).toEqual(emitters);
  expect(calls.filter((call) => call.method === 'getBridgeInfoV1')).toHaveLength(initialized);
  expect(calls.filter((call) => call.method === 'navigationSetWebHistoryV1').at(-1)?.args).toEqual([
    { depth: 1 },
  ]);
  await expect(facade.auth.login('apple')).rejects.toMatchObject({ code: 'AUTH_NOT_CONFIGURED' });
  expect(errors).toEqual([]);
  router.history.destroy();
});

it('releases StrictMode/pagehide state and reinitializes BFCache callbacks without stale runtimes', async () => {
  const calls = host();
  const router = setup();
  await mount(router);
  const push = captured.platform.navigation.push;
  const initial = calls.filter((call) => call.method === 'getBridgeInfoV1').length;
  expect(Object.keys(nativeWindow.nativeEmitterMap!)).toHaveLength(1);
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(nativeWindow.nativeEmitterMap).toEqual({});
  await expect(push('/next')).rejects.toMatchObject({ code: 'BRIDGE_NOT_READY' });
  await act(async () => {
    window.dispatchEvent(new Event('pageshow'));
  });
  await vi.waitFor(() => expect(captured.status).toBe('native'));
  await act(async () => {
    await push('/next');
  });
  expect(router.state.location.pathname).toBe('/next');
  expect(calls.filter((call) => call.method === 'getBridgeInfoV1')).toHaveLength(initial + 1);
  expect(Object.keys(nativeWindow.nativeEmitterMap!)).toHaveLength(1);
  expect(errors).toEqual([]);
  router.history.destroy();
});

it('uses real browser history and synchronizes depth on browser back/pop', async () => {
  window.history.replaceState(null, '', '/');
  const calls = host();
  const router = setup(true);
  await mount(router);
  const web = createWebNavigation(router);
  await act(async () => {
    await web.push('/next');
  });
  expect(web.depth()).toBe(1);
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await vi.waitFor(() => expect(web.depth()).toBe(0));
  await vi.waitFor(() =>
    expect(
      calls.filter((call) => call.method === 'navigationSetWebHistoryV1').at(-1)?.args,
    ).toEqual([{ depth: 0 }]),
  );
  expect(errors).toEqual([]);
  router.history.destroy();
});
