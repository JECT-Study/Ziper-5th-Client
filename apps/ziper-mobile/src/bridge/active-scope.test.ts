import { describe, expect, it, vi } from 'vitest';
import { failure, success, type NativeAuthService, type SheetInput } from '@ziper/bridge/contract';
import { ActiveScope } from './active-scope';
import { createHandlers, type HostServices } from './handlers';
import { hostConfig } from './security';
import { SheetSessions, type SheetSnapshot } from './sheets';

const request: SheetInput = {
  title: 'Actions',
  operationId: 'sheet',
  actions: [{ id: 'save', label: 'Save' }],
};

type Scope = ReturnType<typeof createHandlers> & { sheets: SheetSessions; back: () => boolean };

// Production scope/handlers; auth and router are doubles, not a device renderer.
function fixture() {
  const live = {
    current: {
      auth: undefined as NativeAuthService | undefined,
      config: hostConfig('https://service.example/app', false, 'ios'),
      navigate: vi.fn(),
      back: vi.fn(() => true),
      active: true,
      depth: 0,
    },
  };
  const scopes = new ActiveScope<Scope>();
  let presented: { owner: SheetSessions; snapshot: SheetSnapshot } | null = null;
  const create = vi.fn(() => {
    const sheets = new SheetSessions((snapshot) => {
      presented = snapshot ? { snapshot, owner: sheets } : null;
    });
    const back = () => live.current.back();
    const host: HostServices = {
      get config() {
        return live.current.config;
      },
      get auth() {
        return live.current.auth;
      },
      platform: 'ios',
      appVersion: '1',
      active: () => live.current.active,
      navigate: (kind, path) => live.current.navigate(kind, path),
      back,
      setDepth: (value) => {
        live.current.depth = value;
      },
      sheets,
    };
    return { ...createHandlers(host), sheets, back };
  });
  const invoke: Scope['invoke'] = (method, ...args) =>
    scopes.current?.invoke(method, ...args) ?? Promise.resolve(failure('PERMISSION_DENIED'));
  const back = () => scopes.current?.back() ?? false;
  return { scopes, create, live, invoke, back, presented: () => presented };
}

describe('effect-owned screen scope activations', () => {
  it('allocates nothing before activation and forwards through repeated StrictMode-style cleanup/setup', async () => {
    const f = fixture();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.back()).toBe(false);
    expect(await f.invoke('getBridgeInfoV1')).toEqual(failure('PERMISSION_DENIED'));
    const scopes = new Set<Scope>();
    let previous: ReturnType<typeof f.presented> = null;
    for (let i = 0; i < 4; i++) {
      const cleanup = f.scopes.activate(f.create);
      const scope = f.scopes.current!;
      expect(scopes.has(scope)).toBe(false);
      scopes.add(scope);
      const pending = f.invoke('sheetActionsV1', request);
      await Promise.resolve();
      expect(scope.sheets.active).toBe(true);
      if (previous) {
        // Tokens restart per activation; a colliding token must not address a new owner.
        expect(previous.owner.settle(previous.snapshot.token, 'save')).toBe(false);
        expect(scope.sheets.active).toBe(true);
      }
      previous = f.presented();
      cleanup();
      cleanup();
      expect(f.scopes.current).toBeNull();
      expect(await pending).toEqual(success({ status: 'cancelled' }));
      expect(await scope.invoke('getBridgeInfoV1')).toEqual(failure('PERMISSION_DENIED'));
      expect(await f.invoke('sheetActionsV1', request)).toEqual(failure('PERMISSION_DENIED'));
    }
    expect(f.create).toHaveBeenCalledTimes(4);
  });

  it('keeps a live scope/sheet across depth and dependency updates and forwards to latest auth/router/config refs', async () => {
    const f = fixture();
    const cleanup = f.scopes.activate(f.create);
    const scope = f.scopes.current;
    const pending = f.invoke('sheetActionsV1', request);
    await Promise.resolve();
    for (const depth of [1, 3, 0, 2]) {
      expect(await f.invoke('navigationSetWebHistoryV1', { depth })).toEqual(
        success({ done: true }),
      );
      expect(f.live.current.depth).toBe(depth);
      expect(f.scopes.current).toBe(scope);
      expect(scope!.sheets.active).toBe(true);
    }
    const auth: NativeAuthService = {
      providers: [],
      login: vi.fn(async () => ({ status: 'cancelled' as const })),
      openBrowser: vi.fn(async () => ({ status: 'cancelled' as const })),
      restore: vi.fn(async () => ({ handoffCode: null })),
      adopt: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
    };
    const oldNavigate = f.live.current.navigate,
      oldBack = f.live.current.back;
    f.live.current = {
      ...f.live.current,
      auth,
      config: hostConfig('https://next.example/service', false, 'ios'),
      navigate: vi.fn(),
      back: vi.fn(() => false),
    };
    expect(await f.invoke('getBridgeInfoV1')).toMatchObject({
      ok: true,
      value: { capabilities: expect.arrayContaining(['auth.browser.v1']) },
    });
    expect(await f.invoke('authOpenBrowserV1', { provider: 'naver', transactionId: 'tx' })).toEqual(
      success({ status: 'cancelled' }),
    );
    expect(auth.openBrowser).toHaveBeenCalledOnce();
    expect(await f.invoke('navigationPushV1', { path: '/next', operationId: 'push' })).toEqual(
      success({ handled: true }),
    );
    expect(f.live.current.navigate).toHaveBeenCalledWith('push', '/next');
    expect(oldNavigate).not.toHaveBeenCalled();
    expect(f.back()).toBe(false);
    expect(oldBack).not.toHaveBeenCalled();
    expect(f.scopes.current).toBe(scope);
    expect(f.create).toHaveBeenCalledOnce();
    const sheet = f.presented()!;
    sheet.owner.settle(sheet.snapshot.token, 'save');
    expect(await pending).toEqual(success({ status: 'selected', actionId: 'save' }));
    cleanup();
  });

  it('ignores delayed cleanup of an older activation and never forwards to its disposed handlers', async () => {
    const f = fixture();
    const oldCleanup = f.scopes.activate(f.create);
    const old = f.scopes.current!;
    const cleanup = f.scopes.activate(f.create);
    const current = f.scopes.current;
    oldCleanup();
    expect(f.scopes.current).toBe(current);
    expect(await old.invoke('getBridgeInfoV1')).toEqual(failure('PERMISSION_DENIED'));
    expect((await f.invoke('getBridgeInfoV1')).ok).toBe(true);
    cleanup();
  });

  it('releases the old scope before failed activation and makes cleanup exactly once', () => {
    const scopes = new ActiveScope<{ dispose: () => void }>();
    const dispose = vi.fn();
    const cleanup = scopes.activate(() => ({ dispose }));
    expect(() =>
      scopes.activate(() => {
        throw new Error('setup failed');
      }),
    ).toThrow('setup failed');
    expect(scopes.current).toBeNull();
    cleanup();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('never closes another mounted screen scope', async () => {
    const a = fixture(),
      b = fixture();
    const stopA = a.scopes.activate(a.create),
      stopB = b.scopes.activate(b.create);
    const pendingA = a.invoke('sheetActionsV1', request),
      pendingB = b.invoke('sheetActionsV1', request);
    await Promise.resolve();
    stopA();
    expect(await pendingA).toEqual(success({ status: 'cancelled' }));
    expect(b.scopes.current!.sheets.active).toBe(true);
    const sheet = b.presented()!;
    sheet.owner.settle(sheet.snapshot.token, 'save');
    expect(await pendingB).toEqual(success({ status: 'selected', actionId: 'save' }));
    stopB();
  });
});
