import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  BridgeError,
  capability,
  success,
  type LoginResult,
  type NativeAuthService,
} from '@ziper/bridge/contract';
import { deferred } from '../../../../packages/bridge/test/deferred';
import {
  bridgeInfo,
  checkedResult,
  createHandlers,
  validArguments,
  type HostServices,
} from './handlers';
import { hostConfig } from './security';
import { SheetSessions } from './sheets';

function fixture(auth?: NativeAuthService) {
  let active = true;
  const host: HostServices = {
    config: hostConfig('https://service.example/app', false, 'ios'),
    auth,
    platform: 'ios',
    appVersion: '1.0.0',
    active: () => active,
    navigate: vi.fn(),
    back: vi.fn(() => false),
    setDepth: vi.fn(),
    sheets: new SheetSessions(() => {}),
  };
  const handler = createHandlers(host);
  onTestFinished(handler.dispose);
  return {
    host,
    handler,
    deactivate: () => {
      active = false;
    },
  };
}

function authService(): NativeAuthService {
  return {
    providers: ['apple'],
    login: vi.fn(async () => ({ status: 'cancelled' as const })),
    restore: vi.fn(async () => ({ handoffCode: null })),
    adopt: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  };
}

function pendingLogin() {
  const { promise, resolve } = deferred<LoginResult>();
  const auth = authService();
  auth.login = vi.fn(() => promise);
  return { ...fixture(auth), auth, complete: resolve };
}

const unsupported = { ok: false, error: { code: 'UNSUPPORTED' } };
describe('strict contract and unsupported guards (real shared schemas)', () => {
  it('takes zero arguments for no-input RPC, not null or undefined workaround arguments', () => {
    for (const method of ['getBridgeInfoV1', 'navigationBackV1', 'authLogoutV1'] as const) {
      expect(validArguments(method, [])).toBe(true);
      expect(validArguments(method, [null])).toBe(false);
      expect(validArguments(method, [undefined])).toBe(false);
    }
    expect(validArguments('navigationPushV1', [])).toBe(false);
    expect(
      validArguments('navigationPushV1', [{ path: '/a', operationId: 'a', extra: true }]),
    ).toBe(false);
    expect(validArguments('navigationSetWebHistoryV1', [{ depth: 10001 }])).toBe(false);
  });
  it('advertises only configured auth capabilities, never fake defaults', async () => {
    const { host, handler } = fixture();
    const info = bridgeInfo(host);
    expect(info.capabilities.some((name) => name.startsWith('auth.'))).toBe(false);
    expect(info.methods.some((name) => name.startsWith('auth'))).toBe(false);
    expect(info.capabilities).toEqual([
      capability.push,
      capability.replace,
      capability.back,
      capability.history,
      capability.sheet,
    ]);
    expect(await handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' })).toEqual(
      unsupported,
    );
    expect(
      await handler.invoke('authOpenBrowserV1', { provider: 'apple', transactionId: 'tx' }),
    ).toEqual(unsupported);
    expect(await handler.invoke('authGetWebSessionV1', { transactionId: 'tx' })).toEqual(
      unsupported,
    );
    expect(await handler.invoke('authAdoptWebSessionV1', { handoffCode: 'one-use-code' })).toEqual(
      unsupported,
    );
    expect(await handler.invoke('authLogoutV1')).toEqual(unsupported);
  });
  it('delegates login/restore/adopt/logout only to the injected provider service', async () => {
    const auth = authService(),
      { host, handler } = fixture(auth);
    expect(bridgeInfo(host).capabilities).toContain(capability.login('apple'));
    expect(bridgeInfo(host).capabilities).not.toContain(capability.login('kakao'));
    expect(bridgeInfo(host).capabilities).not.toContain(capability.browser);
    expect(await handler.invoke('authLoginV1', { provider: 'kakao', transactionId: 'tx' })).toEqual(
      unsupported,
    );
    expect(auth.login).not.toHaveBeenCalled();
    expect(await handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' })).toEqual(
      success({ status: 'cancelled' }),
    );
    expect(auth.login).toHaveBeenCalledWith({ provider: 'apple', transactionId: 'tx' });
    expect(
      await handler.invoke('authOpenBrowserV1', { provider: 'apple', transactionId: 'tx' }),
    ).toEqual(unsupported);
    expect(await handler.invoke('authGetWebSessionV1', { transactionId: 'tx' })).toEqual(
      success({ handoffCode: null }),
    );
    expect(auth.restore).toHaveBeenCalledWith({ transactionId: 'tx' });
    expect(await handler.invoke('authAdoptWebSessionV1', { handoffCode: 'one-use-code' })).toEqual(
      success({ done: true }),
    );
    expect(auth.adopt).toHaveBeenCalledWith({ handoffCode: 'one-use-code' });
    expect(await handler.invoke('authLogoutV1')).toEqual(success({ done: true }));
    expect(auth.logout).toHaveBeenCalledOnce();
  });
  it('advertises configured browser independently of installed SDK providers', async () => {
    const auth = authService();
    auth.providers = [];
    auth.openBrowser = vi.fn(async () => ({ status: 'cancelled' as const }));
    const { host, handler } = fixture(auth);
    expect(bridgeInfo(host).capabilities).toContain(capability.browser);
    expect(bridgeInfo(host).capabilities).not.toContain(capability.login('apple'));
    for (const provider of ['naver', 'kakao', 'apple'] as const) {
      expect(await handler.invoke('authLoginV1', { provider, transactionId: 'tx' })).toEqual(
        unsupported,
      );
      expect(await handler.invoke('authOpenBrowserV1', { provider, transactionId: 'tx' })).toEqual(
        success({ status: 'cancelled' }),
      );
      expect(auth.openBrowser).toHaveBeenLastCalledWith({ provider, transactionId: 'tx' });
    }
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.openBrowser).toHaveBeenCalledTimes(3);
    expect(
      await handler.invoke('authOpenBrowserV1', {
        provider: 'arbitrary' as never,
        transactionId: 'tx',
      }),
    ).toEqual({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(auth.openBrowser).toHaveBeenCalledTimes(3);
  });
  it('sanitizes SDK exceptions and refuses extra output fields including sensitive nested data', async () => {
    const auth = authService();
    auth.login = async () => {
      throw new Error('secret-token');
    };
    const { handler } = fixture(auth);
    expect(await handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' })).toEqual(
      { ok: false, error: { code: 'INTERNAL' } },
    );
    expect(
      checkedResult(
        'authLoginV1',
        success({ status: 'completed', handoffCode: 'code', accessToken: 'secret' }),
      ),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(
      checkedResult('authLoginV1', { ok: false, error: { code: 'INTERNAL', secret: 'token' } }),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(checkedResult('authLoginV1', success({ status: 'completed', handoffCode: '' })).ok).toBe(
      false,
    );
  });
  it.each(['AUTH_FAILED', 'PERMISSION_DENIED', 'UNSUPPORTED'] as const)(
    'preserves trusted %s signals across every auth adapter without messages',
    async (code) => {
      const fail = async () => {
        const error = new BridgeError(code);
        error.message = 'SDK secret, authorization code, callback URL';
        throw error;
      };
      const auth: NativeAuthService = {
        providers: ['apple'],
        login: fail,
        openBrowser: fail,
        restore: fail,
        adopt: fail,
        logout: fail,
      };
      const { handler } = fixture(auth);
      const results = [
        await handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' }),
        await handler.invoke('authOpenBrowserV1', { provider: 'naver', transactionId: 'tx' }),
        await handler.invoke('authGetWebSessionV1', { transactionId: 'tx' }),
        await handler.invoke('authAdoptWebSessionV1', { handoffCode: 'one-use' }),
        await handler.invoke('authLogoutV1'),
      ];
      expect(results).toEqual(Array.from({ length: 5 }, () => ({ ok: false, error: { code } })));
    },
  );
  it.each([
    new Error('secret'),
    'secret',
    { code: 'UNSUPPORTED', message: 'SDK secret' },
    Object.assign(new Error('secret'), { code: 'AUTH_FAILED' }),
    new BridgeError('RESULT_UNKNOWN'),
    new BridgeError('INVALID_REQUEST'),
    new BridgeError('INTERNAL'),
  ])('sanitizes untrusted SDK errors and non-allowlisted BridgeErrors: %s', async (error) => {
    const auth = authService();
    auth.login = async () => {
      throw error;
    };
    expect(
      await fixture(auth).handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' }),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
  it('blocks overlapping auth calls but never caches a settled handoff or owns transaction idempotency', async () => {
    const first = deferred<LoginResult>();
    const second = deferred<LoginResult>();
    const auth = authService();
    auth.openBrowser = vi.fn(async () => ({ status: 'cancelled' as const }));
    auth.login = vi
      .fn<NativeAuthService['login']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { handler } = fixture(auth);
    const request = { provider: 'apple' as const, transactionId: 'tx' };
    const pending = handler.invoke('authLoginV1', request);
    for (const result of [
      await handler.invoke('authLoginV1', request),
      await handler.invoke('authOpenBrowserV1', request),
      await handler.invoke('authGetWebSessionV1', { transactionId: 'other' }),
      await handler.invoke('authAdoptWebSessionV1', { handoffCode: 'code' }),
    ])
      expect(result).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(auth.login).toHaveBeenCalledOnce();
    expect(auth.openBrowser).not.toHaveBeenCalled();
    expect(auth.restore).not.toHaveBeenCalled();
    expect(auth.adopt).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    first.resolve({ status: 'completed', handoffCode: 'one-use' });
    expect(await pending).toEqual(success({ status: 'completed', handoffCode: 'one-use' }));
    const retry = handler.invoke('authLoginV1', request);
    expect(auth.login).toHaveBeenCalledTimes(2);
    second.resolve({ status: 'completed', handoffCode: 'server-owned-retry' });
    expect(await retry).toEqual(
      success({ status: 'completed', handoffCode: 'server-owned-retry' }),
    );
  });
  it('allows logout during pending login and revokes the older reply', async () => {
    const { handler, auth, complete } = pendingLogin();
    const pending = handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'old' });
    expect(await handler.invoke('authLogoutV1')).toEqual(success({ done: true }));
    expect(auth.logout).toHaveBeenCalledOnce();
    complete({ status: 'completed', handoffCode: 'revoked' });
    expect(await pending).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
  it('does not invalidate an earlier logout when another logout starts', async () => {
    const finish: (() => void)[] = [];
    const auth = authService();
    auth.logout = vi.fn(() => new Promise<void>((resolve) => finish.push(resolve)));
    const { handler } = fixture(auth);
    const first = handler.invoke('authLogoutV1');
    const second = handler.invoke('authLogoutV1');
    expect(auth.logout).toHaveBeenCalledTimes(2);
    finish[0]();
    await expect(first).resolves.toEqual(success({ done: true }));
    finish[1]();
    await expect(second).resolves.toEqual(success({ done: true }));
  });
  it('suppresses late service completion when the originating screen is no longer active', async () => {
    const { handler, deactivate, complete } = pendingLogin();
    const pending = handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' });
    deactivate();
    complete({ status: 'cancelled' });
    expect(await pending).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
  it('revokes pending handoffs on blur even if focus returns before the SDK settles', async () => {
    const { handler, host, complete } = pendingLogin();
    const pending = handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' });
    handler.suspend();
    expect(host.active()).toBe(true);
    complete({ status: 'completed', handoffCode: 'revoked-late-code' });
    expect(await pending).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await handler.invoke('authGetWebSessionV1', { transactionId: 'new' })).toEqual(
      success({ handoffCode: null }),
    );
  });
  it('suppresses late auth completion after disposal even if the service still considers the route active', async () => {
    const { handler, complete } = pendingLogin();
    const pending = handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' });
    handler.dispose();
    complete({ status: 'cancelled' });
    expect(await pending).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
  it('denies all effects on inactive screens while allowing manifest/history synchronization', async () => {
    const auth = authService();
    auth.openBrowser = vi.fn(async () => ({ status: 'cancelled' as const }));
    const { host, handler, deactivate } = fixture(auth);
    deactivate();
    expect(await handler.invoke('getBridgeInfoV1')).toEqual(success(bridgeInfo(host)));
    expect(await handler.invoke('navigationSetWebHistoryV1', { depth: 7 })).toEqual(
      success({ done: true }),
    );
    expect(host.setDepth).toHaveBeenCalledWith(7);
    for (const result of [
      await handler.invoke('authLoginV1', { provider: 'apple', transactionId: 'tx' }),
      await handler.invoke('authOpenBrowserV1', { provider: 'naver', transactionId: 'tx' }),
      await handler.invoke('authGetWebSessionV1', { transactionId: 'tx' }),
      await handler.invoke('authAdoptWebSessionV1', { handoffCode: 'one-use' }),
      await handler.invoke('authLogoutV1'),
      await handler.invoke('navigationPushV1', { path: '/a', operationId: 'push' }),
      await handler.invoke('navigationReplaceV1', { path: '/a', operationId: 'replace' }),
      await handler.invoke('navigationBackV1'),
      await handler.invoke('sheetActionsV1', {
        title: 'Actions',
        operationId: 'sheet',
        actions: [{ id: 'a', label: 'A' }],
      }),
    ])
      expect(result).toEqual({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    for (const action of [
      auth.login,
      auth.openBrowser,
      auth.restore,
      auth.adopt,
      auth.logout,
      host.navigate,
      host.back,
    ])
      expect(action).not.toHaveBeenCalled();
    expect(host.sheets.active).toBe(false);
    handler.dispose();
    expect(await handler.invoke('getBridgeInfoV1')).toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED' },
    });
    expect(await handler.invoke('navigationSetWebHistoryV1', { depth: 2 })).toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED' },
    });
    expect(host.setDepth).toHaveBeenCalledOnce();
  });
  it('does not reclassify an executed native pop as unsupported/unhandled when it synchronously disposes the source', async () => {
    const { host } = fixture();
    const back = vi.fn(() => {
      handler.dispose();
      return true;
    });
    const handler = createHandlers({ ...host, back });
    expect(await handler.invoke('navigationBackV1')).toEqual(success({ handled: true }));
    expect(back).toHaveBeenCalledOnce();
    expect(await handler.invoke('navigationBackV1')).toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED' },
    });
    expect(back).toHaveBeenCalledOnce();
  });
  it('connects navigation, deduplicates operation IDs and rejects scope escapes', async () => {
    const { host, handler } = fixture();
    const request = { path: '/items/1', operationId: 'push-1' };
    expect(await handler.invoke('navigationPushV1', request)).toEqual(success({ handled: true }));
    await handler.invoke('navigationPushV1', request);
    expect(host.navigate).toHaveBeenCalledTimes(1);
    expect(host.navigate).toHaveBeenCalledWith('push', '/items/1');
    expect((await handler.invoke('navigationReplaceV1', request)).ok).toBe(false);
    await handler.invoke('navigationReplaceV1', { ...request, operationId: 'replace-1' });
    expect(host.navigate).toHaveBeenLastCalledWith('replace', '/items/1');
    expect(
      (await handler.invoke('navigationPushV1', { path: '/%2e%2e/outside', operationId: 'escape' }))
        .ok,
    ).toBe(false);
    expect(await handler.invoke('navigationBackV1')).toEqual(success({ handled: false }));
    expect(await handler.invoke('navigationSetWebHistoryV1', { depth: 3 })).toEqual(
      success({ done: true }),
    );
    expect(host.setDepth).toHaveBeenCalledWith(3);
    handler.dispose();
    expect(
      (await handler.invoke('navigationPushV1', { ...request, operationId: 'after-unmount' })).ok,
    ).toBe(false);
  });
  it('deduplicates sheet promises and cancels them on screen disposal', async () => {
    const { host, handler } = fixture();
    const request = { title: 'Menu', operationId: 'sheet', actions: [{ id: 'a', label: 'A' }] };
    const a = handler.invoke('sheetActionsV1', request),
      b = handler.invoke('sheetActionsV1', request);
    await Promise.resolve();
    expect(host.sheets.active).toBe(true);
    expect((await handler.invoke('sheetActionsV1', { ...request, title: 'Conflict' })).ok).toBe(
      false,
    );
    handler.dispose();
    expect(await a).toEqual(success({ status: 'cancelled' }));
    expect(await b).toEqual(success({ status: 'cancelled' }));
  });
});
