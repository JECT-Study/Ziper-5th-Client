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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
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
  vi.unstubAllGlobals();
});
async function mount(router: ReturnType<typeof setup>, status: 'native' | 'web' = 'native') {
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
  await vi.waitFor(() => expect(captured?.status).toBe(status));
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

const sheetActions = [{ id: 'save', label: '저장' }];

it('keeps a web sheet through query and hash changes and cancels it on browser Back to another route', async () => {
  window.history.replaceState(null, '', '/');
  const router = setup(true);
  await mount(router, 'web');
  await act(async () => createWebNavigation(router).push('/next'));
  const { result, element } = await openWebSheet();

  await act(async () => router.history.replace('/next?tab=other#top'));
  await vi.waitFor(() => expect(router.state.location.href).toBe('/next?tab=other#top'));
  expect(element.isConnected && element.open).toBe(true);

  await act(async () => {
    window.history.back();
    await vi.waitFor(() => expect(router.history.location.pathname).toBe('/'));
  });
  expect(router.state.location.pathname).toBe('/');
  await expect(result).resolves.toEqual({ status: 'cancelled' });
  expect(document.querySelector('dialog')).toBeNull();

  const reopened = await openWebSheet();
  await act(async () => reopened.element.close());
  await expect(reopened.result).resolves.toEqual({ status: 'cancelled' });
  router.history.destroy();
});

it('does not open a web fallback if its requesting route was left before presentation', async () => {
  const router = setup();
  await mount(router, 'web');
  let result!: ReturnType<typeof captured.platform.sheets.actions>;
  await act(async () => {
    result = captured.platform.sheets.actions({ title: '작업 선택', actions: sheetActions });
    router.history.push('/next');
  });
  await expect(result).resolves.toEqual({ status: 'cancelled' });
  expect(router.state.location.pathname).toBe('/next');
  expect(document.querySelector('dialog')).toBeNull();
  router.history.destroy();
});

it('renders the design system dialog, settles selection once, and restores focus', async () => {
  const router = setup();
  await mount(router, 'web');
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();

  const dialog = await openWebSheet();
  const result = dialog.result;
  const sheet = dialog.element;
  expect(sheet.open).toBe(true);
  expect(sheet.getAttribute('aria-modal')).toBe('true');
  expect(document.getElementById(sheet.getAttribute('aria-labelledby')!)?.textContent).toBe(
    '작업 선택',
  );
  const save = [...sheet.querySelectorAll('button')].find(
    (button) => button.textContent === '저장',
  )!;
  save.focus();
  await act(async () => {
    save.click();
    save.click();
    await expect(result).resolves.toEqual({ status: 'selected', actionId: 'save' });
  });
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  router.history.destroy();
});

async function openWebSheet() {
  let result!: ReturnType<typeof captured.platform.sheets.actions>;
  await act(async () => {
    result = captured.platform.sheets.actions({ title: '작업 선택', actions: sheetActions });
  });
  return { result, element: document.querySelector('dialog')! };
}

it.each(['x', 'cancel button', 'escape', 'backdrop'])(
  'closes via %s without a selection',
  async (mode) => {
    const router = setup();
    await mount(router, 'web');
    const { element, result } = await openWebSheet();
    await act(async () => {
      if (mode === 'x') element.querySelector<HTMLButtonElement>('[aria-label="닫기"]')!.click();
      else if (mode === 'cancel button')
        [...element.querySelectorAll('button')]
          .find((button) => button.textContent === '취소')!
          .click();
      else if (mode === 'escape') element.dispatchEvent(new Event('cancel', { cancelable: true }));
      else {
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 200, 100));
        clickFrom(element, 10, 10);
      }
      await expect(result).resolves.toEqual({ status: 'cancelled' });
    });
    expect(document.querySelector('dialog')).toBeNull();
    router.history.destroy();
  },
);

function clickFrom(dialog: HTMLDialogElement, startY: number, endY: number) {
  dialog.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, clientY: startY }),
  );
  dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientY: endY }));
}

it('keeps the sheet open when a press starts or ends inside it', async () => {
  const router = setup();
  await mount(router, 'web');
  const { element, result } = await openWebSheet();
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 200, 100));

  await act(async () => {
    clickFrom(element, 40, 10);
    clickFrom(element, 10, 40);
  });
  expect(element.open).toBe(true);

  await act(async () => {
    clickFrom(element, 10, 10);
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });
  router.history.destroy();
});

it('clears failed web presentations and aborts an open one on pagehide', async () => {
  const router = setup();
  await mount(router, 'web');
  const showModal = vi.spyOn(window.HTMLDialogElement.prototype, 'showModal');
  showModal.mockImplementationOnce(() => {
    throw new Error('unsupported');
  });
  let rejected!: Promise<void>;
  await act(async () => {
    rejected = expect(
      captured.platform.sheets.actions({ title: '', actions: sheetActions }),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });
  await rejected;
  expect(document.querySelector('dialog')).toBeNull();

  const { result } = await openWebSheet();
  const closed = expect(result).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  await act(async () => window.dispatchEvent(new Event('pagehide')));
  await closed;
  expect(document.querySelector('dialog')).toBeNull();

  await act(async () => window.dispatchEvent(new Event('pageshow')));
  const reopened = await openWebSheet();
  await act(async () => reopened.element.close());
  await expect(reopened.result).resolves.toEqual({ status: 'cancelled' });
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
