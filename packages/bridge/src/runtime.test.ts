// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BridgeError,
  capability,
  failure,
  methods,
  success,
  type BridgeInfo,
  type Method,
  type Runtime,
  type Session,
  type WebServices,
} from './contract';
import { createPlatform, createRuntime } from './runtime';
import { deferred } from '../test/deferred';

// Real patched web client; only native postMessage is doubled.
type Emitter = { emit(name: string, ...args: unknown[]): void; events: Record<string, unknown> };

type NativeWindow = Window & {
  __bridgeMethods__?: string[];
  ReactNativeWebView?: { postMessage(raw: string): void };
  nativeEmitterMap?: Record<string, Emitter>;
  nativeEmitter?: Emitter;
};

const hostWindow = window as NativeWindow;

const runtimes: Runtime[] = [];

const makeRuntime = (options: Parameters<typeof createRuntime>[0] = {}) => {
  const runtime = createRuntime({
    handshakeTimeoutMs: 40,
    callTimeoutMs: 60,
    interactiveTimeoutMs: 60,
    injectionPollMs: 5,
    ...options,
  });
  runtimes.push(runtime);
  return runtime;
};

function host(
  options: {
    capabilities?: string[];
    advertised?: Method[];
    reply?: (method: Method, input: unknown) => unknown;
    ackOnly?: Method;
  } = {},
) {
  const calls: { method: Method; args: unknown[] }[] = [];
  const info: BridgeInfo = {
    protocolVersion: 1,
    appVersion: '1',
    platform: 'ios',
    methods: options.advertised ?? Object.keys(methods),
    capabilities:
      options.capabilities ??
      (Object.values(capability).filter((value) => typeof value === 'string') as string[]),
  };
  hostWindow.__bridgeMethods__ = Object.keys(methods);
  hostWindow.ReactNativeWebView = {
    postMessage(raw) {
      const message = JSON.parse(raw);
      if (message.type !== 'bridge') return;
      const { method, args, eventId } = message.body;
      calls.push({ method, args });
      const emitter = hostWindow.nativeEmitterMap![message.bridgeId];
      emitter.emit(`${method}-${eventId}:ack`);
      if (options.ackOnly === method) return;
      queueMicrotask(() => {
        const result =
          method === 'getBridgeInfoV1'
            ? success(info)
            : (options.reply?.(method, args[0]) ?? success({ done: true }));
        emitter.emit(`${method}-${eventId}`, result);
      });
    },
  };
  return { calls, info };
}
afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  delete hostWindow.ReactNativeWebView;
  delete hostWindow.__bridgeMethods__;
  delete hostWindow.nativeEmitter;
  delete hostWindow.nativeEmitterMap;
  vi.useRealTimers();
});
const signedIn: Session = { status: 'signedIn', profile: { id: 'account', displayName: null } };

const sheetInput = {
  title: 'Actions',
  operationId: 'sheet',
  actions: [{ id: 'save', label: 'Save' }],
};

function webServices(): WebServices & { auth: NonNullable<WebServices['auth']> } {
  return {
    auth: {
      login: vi.fn(async () => signedIn),
      session: {
        createTransaction: vi.fn(async () => ({ transactionId: 'transaction' })),
        exchange: vi.fn(async () => signedIn),
        current: vi.fn(async () => signedIn),
        nativeHandoff: vi.fn(async () => ({ handoffCode: 'server-issued-handoff' })),
        logout: vi.fn(async () => {}),
      },
    },
    navigation: {
      push: vi.fn(async () => {}),
      replace: vi.fn(async () => {}),
      back: vi.fn(async () => {}),
      depth: () => 2,
    },
    sheets: { actions: vi.fn(async () => ({ status: 'cancelled' as const })) },
  };
}

describe('production runtime', () => {
  it('generates native operation IDs without the secure-context-only randomUUID API', async () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('randomUUID unavailable on development HTTP');
    });
    const { calls } = host({
      reply: (method) =>
        method === 'sheetActionsV1'
          ? success({ status: 'selected', actionId: 'save' })
          : success({ handled: true }),
    });
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    try {
      await platform.navigation.push('/profile');
      await expect(
        platform.sheets.actions({ title: 'Actions', actions: sheetInput.actions }),
      ).resolves.toEqual({ status: 'selected', actionId: 'save' });
      const ids = calls
        .filter((call) => call.method === 'navigationPushV1' || call.method === 'sheetActionsV1')
        .map((call) => (call.args[0] as { operationId: string }).operationId);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
      expect(ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 128)).toBe(
        true,
      );
      expect(uuid).not.toHaveBeenCalled();
      expect(web.navigation.push).not.toHaveBeenCalled();
      expect(web.sheets.actions).not.toHaveBeenCalled();
    } finally {
      platform.dispose();
    }
  });
  it('deduplicates handshake, negotiates method AND capability, and uses zero no-input arguments', async () => {
    const { calls } = host({
      capabilities: [capability.logout, capability.sheet],
      advertised: ['getBridgeInfoV1', 'authLogoutV1'],
    });
    const runtime = makeRuntime();
    const listener = vi.fn();
    const off = runtime.subscribe(listener);
    await Promise.all([runtime.initialize(), runtime.initialize(), runtime.initialize()]);
    expect(calls.filter((call) => call.method === 'getBridgeInfoV1')).toHaveLength(1);
    expect(calls[0].args).toEqual([]);
    expect(runtime.status).toBe('native');
    expect(runtime.supports(capability.logout, 'authLogoutV1')).toBe(true);
    expect(runtime.supports(capability.sheet, 'sheetActionsV1')).toBe(false);
    expect(runtime.supports(capability.restore, 'authLogoutV1')).toBe(false);
    await runtime.invoke('authLogoutV1', undefined);
    expect(calls.at(-1)?.args).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
    off();
    runtime.dispose();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('starts web-only, then detects late native injection', async () => {
    const runtime = makeRuntime();
    await runtime.initialize();
    expect(runtime.status).toBe('web');
    host();
    await vi.waitFor(() => expect(runtime.status).toBe('native'));
  });

  it('stops browser polling at the finite grace deadline, but detects a host on a later invocation', async () => {
    vi.useFakeTimers();
    const runtime = makeRuntime({ injectionPollMs: 100 });
    await runtime.initialize();
    expect(vi.getTimerCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(runtime.status).toBe('web');
    expect(vi.getTimerCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(vi.getTimerCount()).toBe(0);
    await runtime.initialize();
    expect(vi.getTimerCount()).toBe(0);
    const { calls } = host();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toEqual([]);
    await runtime.invoke('authLogoutV1', undefined);
    expect(runtime.status).toBe('native');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['native', 'unavailable', 'closed'] as const)(
    'releases all injection timers on %s',
    async (terminal) => {
      vi.useFakeTimers();
      const runtime = makeRuntime({ injectionGraceMs: 1_000 });
      await runtime.initialize();
      expect(vi.getTimerCount()).toBe(2);
      if (terminal === 'closed') runtime.dispose();
      else {
        host(terminal === 'unavailable' ? { ackOnly: 'getBridgeInfoV1' } : {});
        await vi.advanceTimersByTimeAsync(50);
      }
      expect(runtime.status).toBe(terminal);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('uses the default three-second handshake deadline without polling an existing host', async () => {
    vi.useFakeTimers();
    host({ ackOnly: 'getBridgeInfoV1' });
    const runtime = makeRuntime({ handshakeTimeoutMs: undefined });
    const init = runtime.initialize();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(runtime.status).toBe('initializing');
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await init;
    expect(runtime.status).toBe('unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { method: 'authLogoutV1', input: undefined, deadline: 5_000 },
    {
      method: 'authLoginV1',
      input: { provider: 'apple', transactionId: 'transaction' },
      deadline: 180_000,
    },
    {
      method: 'authOpenBrowserV1',
      input: { provider: 'apple', transactionId: 'transaction' },
      deadline: 180_000,
    },
    { method: 'sheetActionsV1', input: sheetInput, deadline: 180_000 },
  ] as const)(
    'uses the method-specific default deadline for $method',
    async ({ method, input, deadline }) => {
      vi.useFakeTimers();
      host({ ackOnly: method });
      const runtime = makeRuntime({ callTimeoutMs: undefined, interactiveTimeoutMs: undefined });
      await runtime.initialize();
      const result = runtime.invoke(method, input);
      let settled = false;
      void result
        .finally(() => {
          settled = true;
        })
        .catch(() => {});
      const rejected = expect(result).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
      await vi.advanceTimersByTimeAsync(deadline - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rejected;
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('configures interactive timeouts separately from normal calls, with per-call overrides', async () => {
    vi.useFakeTimers();
    host({ ackOnly: 'sheetActionsV1' });
    const runtime = makeRuntime({ callTimeoutMs: 5, interactiveTimeoutMs: 100 });
    await runtime.initialize();
    const result = runtime.invoke('sheetActionsV1', sheetInput);
    const rejected = expect(result).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    await vi.advanceTimersByTimeAsync(99);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    const overridden = expect(
      runtime.invoke('sheetActionsV1', sheetInput, { timeoutMs: 7 }),
    ).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    await vi.advanceTimersByTimeAsync(7);
    await overridden;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds handshake and distinguishes unavailable from unsupported', async () => {
    host({ ackOnly: 'getBridgeInfoV1' });
    const runtime = makeRuntime({ handshakeTimeoutMs: 10 });
    await Promise.all([runtime.initialize(), runtime.initialize()]);
    expect(runtime.status).toBe('unavailable');
    await expect(runtime.invoke('authLogoutV1', undefined)).rejects.toMatchObject({
      code: 'BRIDGE_NOT_READY',
    });
  });

  it('enforces total deadlines AFTER ack and removes pending listeners', async () => {
    host({ ackOnly: 'authLogoutV1' });
    const runtime = makeRuntime();
    await runtime.initialize();
    const emitter = Object.values(hostWindow.nativeEmitterMap!)[0];
    const baseline = Object.keys(emitter.events).length;
    await expect(
      runtime.invoke('authLogoutV1', undefined, { timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    expect(Object.keys(emitter.events)).toHaveLength(baseline);
  });

  it('counts handshake time inside each call deadline without cancelling shared initialization', async () => {
    host({ ackOnly: 'getBridgeInfoV1' });
    const runtime = makeRuntime({ handshakeTimeoutMs: 40 });
    const init = runtime.initialize();
    await expect(runtime.invoke('authLogoutV1', undefined, { timeoutMs: 5 })).rejects.toMatchObject(
      { code: 'RESULT_UNKNOWN' },
    );
    expect(runtime.status).toBe('initializing');
    await init;
    expect(runtime.status).toBe('unavailable');
  });

  it('validates input before sending, validates output, and rejects falsy transport results', async () => {
    const { calls } = host({ reply: () => false });
    const runtime = makeRuntime();
    await runtime.initialize();
    await expect(
      runtime.invoke('navigationPushV1', { path: '//evil.test', operationId: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(calls).toHaveLength(1);
    await expect(runtime.invoke('authLogoutV1', undefined)).rejects.toMatchObject({
      code: 'NATIVE_ERROR',
    });
  });

  it.each([undefined, null, false, 0, ''])(
    'does not swallow a falsy thrown boundary error (%s)',
    async (value) => {
      host();
      const runtime = makeRuntime();
      await runtime.initialize();
      hostWindow.ReactNativeWebView!.postMessage = () => {
        throw value;
      };
      await expect(runtime.invoke('authLogoutV1', undefined)).rejects.toMatchObject({
        code: 'NATIVE_ERROR',
      });
    },
  );

  it('aborts in-flight calls, releases the actual client emitter, and rejects reuse', async () => {
    host({ ackOnly: 'authLogoutV1' });
    const runtime = makeRuntime();
    await runtime.initialize();
    const controller = new AbortController();
    const cancelled = runtime.invoke('authLogoutV1', undefined, { signal: controller.signal });
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    const pending = runtime.invoke('authLogoutV1', undefined);
    await Promise.resolve();
    runtime.dispose();
    runtime.dispose();
    await expect(pending).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
    expect(hostWindow.nativeEmitterMap).toEqual({});
    expect(hostWindow.nativeEmitter).toBeUndefined();
    await expect(runtime.initialize()).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
    await expect(runtime.invoke('authLogoutV1', undefined)).rejects.toMatchObject({
      code: 'BRIDGE_CLOSED',
    });
  });
});

describe('production platform auth and fallback policy', () => {
  it('requires explicit auth configuration', async () => {
    const web = webServices();
    delete (web as WebServices).auth;
    const platform = createPlatform(makeRuntime(), web);
    await expect(platform.auth.login('apple')).rejects.toMatchObject({
      code: 'AUTH_NOT_CONFIGURED',
    });
    await expect(platform.auth.restore()).rejects.toMatchObject({ code: 'AUTH_NOT_CONFIGURED' });
    await expect(platform.auth.logout()).rejects.toMatchObject({ code: 'AUTH_NOT_CONFIGURED' });
  });

  it('invokes the supplied browser login adapter in the caller turn without a handshake or transaction', async () => {
    const runtime = makeRuntime();
    const web = webServices();
    const platform = createPlatform(runtime, web);
    const login = platform.auth.login('apple');
    // No await: an adapter may open its popup synchronously within the user gesture.
    expect(web.auth.login).toHaveBeenCalledWith({ provider: 'apple' });
    expect(runtime.status).toBe('web');
    expect(hostWindow.nativeEmitterMap).toBeUndefined();
    expect(web.auth.session.createTransaction).not.toHaveBeenCalled();
    await expect(login).resolves.toEqual(signedIn);
  });

  it('sequences native SDK → native browser using one transaction → backend exchange', async () => {
    const { calls } = host({
      capabilities: [capability.login('apple'), capability.browser],
      reply: (method) =>
        method === 'authLoginV1'
          ? failure('UNSUPPORTED')
          : success({ status: 'completed', handoffCode: 'native-code' }),
    });
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    await expect(platform.auth.login('apple')).resolves.toEqual(signedIn);
    expect(calls.map((call) => call.method)).toEqual([
      'getBridgeInfoV1',
      'authLoginV1',
      'authOpenBrowserV1',
    ]);
    expect(web.auth.session.createTransaction).toHaveBeenCalledOnce();
    expect(web.auth.session.exchange).toHaveBeenCalledWith({
      transactionId: 'transaction',
      handoffCode: 'native-code',
    });
    expect(web.auth.login).not.toHaveBeenCalled();
  });

  it('falls back to a real supplied web adapter then adopts its server handoff into native', async () => {
    const { calls } = host({
      capabilities: [capability.login('apple'), capability.browser, capability.adopt],
      reply: (method) =>
        method === 'authAdoptWebSessionV1' ? success({ done: true }) : failure('UNSUPPORTED'),
    });
    const web = webServices();
    await createPlatform(makeRuntime(), web).auth.login('apple');
    expect(web.auth.login).toHaveBeenCalledWith({ provider: 'apple' });
    expect(web.auth.session.nativeHandoff).toHaveBeenCalledOnce();
    expect(calls.at(-1)).toEqual({
      method: 'authAdoptWebSessionV1',
      args: [{ handoffCode: 'server-issued-handoff' }],
    });
    expect(web.auth.session.exchange).not.toHaveBeenCalled();
  });

  it.each(['PERMISSION_DENIED', 'AUTH_FAILED', 'INVALID_REQUEST', 'INTERNAL'] as const)(
    'never falls back after %s',
    async (code) => {
      const { calls } = host({
        capabilities: [capability.login('apple'), capability.browser],
        reply: () => failure(code),
      });
      const web = webServices();
      await expect(createPlatform(makeRuntime(), web).auth.login('apple')).rejects.toMatchObject({
        code,
      });
      expect(web.auth.login).not.toHaveBeenCalled();
      expect(calls.map((call) => call.method)).not.toContain('authOpenBrowserV1');
    },
  );

  it('treats cancellation as terminal, never as web fallback', async () => {
    host({
      capabilities: [capability.login('apple')],
      reply: () => success({ status: 'cancelled' }),
    });
    const web = webServices();
    await expect(createPlatform(makeRuntime(), web).auth.login('apple')).resolves.toEqual({
      status: 'cancelled',
    });
    expect(web.auth.login).not.toHaveBeenCalled();
    expect(web.auth.session.exchange).not.toHaveBeenCalled();
  });

  it('does not fall back on timeout or exchange failure', async () => {
    host({ capabilities: [capability.login('apple')], ackOnly: 'authLoginV1' });
    const web = webServices();
    await expect(
      createPlatform(makeRuntime({ interactiveTimeoutMs: 10 }), web).auth.login('apple'),
    ).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    expect(web.auth.login).not.toHaveBeenCalled();
    runtimes.at(-1)!.dispose();
    host({
      capabilities: [capability.login('apple')],
      reply: () => success({ status: 'completed', handoffCode: 'native-code' }),
    });
    vi.mocked(web.auth.session.exchange).mockRejectedValueOnce(new Error('backend'));
    await expect(createPlatform(makeRuntime(), web).auth.login('apple')).rejects.toThrow('backend');
    expect(web.auth.login).not.toHaveBeenCalled();
  });

  it('never interprets backend UNSUPPORTED as permission to repeat native login or restore', async () => {
    const { calls } = host({
      capabilities: [capability.login('apple'), capability.browser, capability.restore],
      reply: (method) =>
        method === 'authGetWebSessionV1'
          ? success({ handoffCode: 'restore-code' })
          : success({ status: 'completed', handoffCode: 'login-code' }),
    });
    const web = webServices();
    vi.mocked(web.auth.session.exchange).mockRejectedValue(new BridgeError('UNSUPPORTED'));
    const platform = createPlatform(makeRuntime(), web);
    await expect(platform.auth.login('apple')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(platform.auth.restore()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(web.auth.login).not.toHaveBeenCalled();
    expect(web.auth.session.current).not.toHaveBeenCalled();
    expect(calls.map((call) => call.method)).not.toContain('authOpenBrowserV1');
  });

  it('does not retry malformed native login output', async () => {
    host({
      capabilities: [capability.login('apple'), capability.browser],
      reply: () => success({ status: 'completed', handoffCode: '' }),
    });
    const web = webServices();
    await expect(createPlatform(makeRuntime(), web).auth.login('apple')).rejects.toMatchObject({
      code: 'NATIVE_ERROR',
    });
    expect(web.auth.login).not.toHaveBeenCalled();
    expect(web.auth.session.exchange).not.toHaveBeenCalled();
  });

  it('restores by native handoff exchange, then logs out native and backend', async () => {
    const { calls } = host({
      capabilities: [capability.restore, capability.logout],
      reply: (method) =>
        method === 'authGetWebSessionV1'
          ? success({ handoffCode: 'restore-code' })
          : success({ done: true }),
    });
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    await expect(platform.auth.restore()).resolves.toEqual(signedIn);
    await platform.auth.logout();
    expect(web.auth.session.exchange).toHaveBeenCalledWith({
      transactionId: 'transaction',
      handoffCode: 'restore-code',
    });
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
    expect(calls.at(-1)?.method).toBe('authLogoutV1');
  });

  it('clears the web cookie even when native logout transport fails', async () => {
    host({ capabilities: [capability.logout] });
    const runtime = makeRuntime();
    await runtime.initialize();
    hostWindow.ReactNativeWebView!.postMessage = () => {
      throw new Error('transport');
    };
    const web = webServices();
    let cookiePresent = true;
    vi.mocked(web.auth.session.logout).mockImplementation(async () => {
      cookiePresent = false;
    });
    await expect(createPlatform(runtime, web).auth.logout()).rejects.toMatchObject({
      code: 'NATIVE_ERROR',
    });
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
    expect(cookiePresent).toBe(false);
  });

  it('attempts native logout even when web session logout throws synchronously', async () => {
    const { calls } = host({ capabilities: [capability.logout] });
    const web = webServices();
    const backendError = new Error('backend logout');
    vi.mocked(web.auth.session.logout).mockImplementation(() => {
      throw backendError;
    });
    await expect(createPlatform(makeRuntime(), web).auth.logout()).rejects.toBe(backendError);
    expect(calls.map((call) => call.method)).toEqual(['getBridgeInfoV1', 'authLogoutV1']);
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
  });

  it('clears the web session without waiting for an unknown native logout outcome', async () => {
    vi.useFakeTimers();
    host({ capabilities: [capability.logout], ackOnly: 'authLogoutV1' });
    const web = webServices();
    const logout = createPlatform(makeRuntime({ callTimeoutMs: 50 }), web).auth.logout();
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
    const rejected = expect(logout).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
  });

  it('reports both logout failures only after attempting both cleanups', async () => {
    host({ capabilities: [capability.logout], reply: () => failure('INTERNAL') });
    const web = webServices();
    const backendError = new Error('backend logout');
    vi.mocked(web.auth.session.logout).mockRejectedValue(backendError);
    const logout = createPlatform(makeRuntime(), web).auth.logout();
    await expect(logout).rejects.toBeInstanceOf(AggregateError);
    await expect(logout).rejects.toMatchObject({
      errors: [expect.objectContaining({ code: 'INTERNAL' }), backendError],
    });
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
  });

  it.each(['login', 'restore'] as const)(
    'rejects disposed %s while awaiting backend exchange',
    async (action) => {
      host({
        capabilities: [capability.login('apple'), capability.restore],
        reply: (method) =>
          success(
            method === 'authGetWebSessionV1'
              ? { handoffCode: 'restore-code' }
              : { status: 'completed', handoffCode: 'login-code' },
          ),
      });
      const web = webServices();
      const exchange = deferred<Session>();
      vi.mocked(web.auth.session.exchange).mockReturnValue(exchange.promise);
      const platform = createPlatform(makeRuntime(), web);
      const result = action === 'login' ? platform.auth.login('apple') : platform.auth.restore();
      await vi.waitFor(() => expect(web.auth.session.exchange).toHaveBeenCalledOnce());
      platform.dispose();
      exchange.resolve(signedIn);
      await expect(result).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
      expect(web.auth.login).not.toHaveBeenCalled();
    },
  );

  it.each([signedIn, null])(
    'rejects disposed restore while awaiting the current web session (%j)',
    async (value) => {
      host({ capabilities: [capability.adopt] });
      const web = webServices();
      const current = deferred<Session | null>();
      vi.mocked(web.auth.session.current).mockReturnValue(current.promise);
      const platform = createPlatform(makeRuntime(), web);
      const result = platform.auth.restore();
      await vi.waitFor(() => expect(web.auth.session.current).toHaveBeenCalledOnce());
      platform.dispose();
      current.resolve(value);
      await expect(result).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
      expect(web.auth.session.nativeHandoff).not.toHaveBeenCalled();
    },
  );

  it.each(['login', 'restore'] as const)(
    'does not adopt or report success after disposal during %s nativeHandoff',
    async (action) => {
      const { calls } = host({ capabilities: [capability.adopt] });
      const web = webServices();
      const handoff = deferred<{ handoffCode: string }>();
      vi.mocked(web.auth.session.nativeHandoff).mockReturnValue(handoff.promise);
      const platform = createPlatform(makeRuntime(), web);
      const result = action === 'login' ? platform.auth.login('apple') : platform.auth.restore();
      await vi.waitFor(() => expect(web.auth.session.nativeHandoff).toHaveBeenCalledOnce());
      platform.dispose();
      handoff.resolve({ handoffCode: 'late-code' });
      await expect(result).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
      expect(calls.map((call) => call.method)).toEqual(['getBridgeInfoV1']);
    },
  );

  it.each(['login', 'restore'] as const)(
    'does not dispatch native %s after disposal during transaction creation',
    async (action) => {
      const { calls } = host({ capabilities: [capability.login('apple'), capability.restore] });
      const web = webServices();
      const transaction = deferred<{ transactionId: string }>();
      vi.mocked(web.auth.session.createTransaction).mockReturnValue(transaction.promise);
      const platform = createPlatform(makeRuntime(), web);
      const result = action === 'login' ? platform.auth.login('apple') : platform.auth.restore();
      await vi.waitFor(() => expect(web.auth.session.createTransaction).toHaveBeenCalledOnce());
      platform.dispose();
      transaction.resolve({ transactionId: 'late-transaction' });
      await expect(result).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
      expect(calls.map((call) => call.method)).toEqual(['getBridgeInfoV1']);
    },
  );

  it('adopts a restored web session when native restore is unsupported', async () => {
    const { calls } = host({
      capabilities: [capability.restore, capability.adopt],
      reply: (method) =>
        method === 'authGetWebSessionV1' ? failure('UNSUPPORTED') : success({ done: true }),
    });
    const web = webServices();
    await expect(createPlatform(makeRuntime(), web).auth.restore()).resolves.toEqual(signedIn);
    expect(web.auth.session.current).toHaveBeenCalledOnce();
    expect(web.auth.session.nativeHandoff).toHaveBeenCalledOnce();
    expect(calls.at(-1)?.method).toBe('authAdoptWebSessionV1');
  });

  it('uses current web session and logout when native does not negotiate them', async () => {
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    await expect(platform.auth.restore()).resolves.toEqual(signedIn);
    await platform.auth.logout();
    expect(web.auth.session.current).toHaveBeenCalledOnce();
    expect(web.auth.session.logout).toHaveBeenCalledOnce();
    expect(web.auth.session.createTransaction).not.toHaveBeenCalled();
  });
});

describe('platform navigation and sheets', () => {
  it('negotiates capabilities, validates paths, and syncs native web-history depth', async () => {
    const { calls } = host({ capabilities: [capability.history] });
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    await platform.navigation.push('/next');
    await platform.navigation.replace('/replacement');
    await platform.navigation.back();
    expect(web.navigation.push).toHaveBeenCalledWith('/next');
    expect(web.navigation.replace).toHaveBeenCalledWith('/replacement');
    expect(web.navigation.back).toHaveBeenCalledOnce();
    expect(calls.filter((call) => call.method === 'navigationSetWebHistoryV1')).toHaveLength(3);
    expect(calls.at(-1)?.args).toEqual([{ depth: 2 }]);
    await expect(platform.navigation.push('https://evil.test')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it.each(['push', 'replace', 'back'] as const)(
    'does not sync a covered or popped WebView after native %s',
    async (action) => {
      let active = true;
      const { calls } = host({
        capabilities: [capability.push, capability.replace, capability.back, capability.history],
        reply: (method) => {
          if (method === 'navigationSetWebHistoryV1')
            return active ? success({ done: true }) : failure('PERMISSION_DENIED');
          active = false;
          return success({ handled: true });
        },
      });
      const web = webServices();
      const platform = createPlatform(makeRuntime(), web);
      await expect(platform.navigation[action]('/next')).resolves.toBeUndefined();
      expect(active).toBe(false);
      expect(calls.map((call) => call.method)).toEqual([
        'getBridgeInfoV1',
        {
          push: 'navigationPushV1',
          replace: 'navigationReplaceV1',
          back: 'navigationBackV1',
        }[action],
      ]);
      expect(web.navigation.push).not.toHaveBeenCalled();
      expect(web.navigation.replace).not.toHaveBeenCalled();
      expect(web.navigation.back).not.toHaveBeenCalled();
    },
  );

  it('serializes native history depth updates in browser-event order', async () => {
    const { calls } = host({ capabilities: [capability.history] });
    const web = webServices();
    let depth = 0;
    web.navigation.depth = () => depth;
    const runtime = makeRuntime();
    await runtime.initialize();
    const platform = createPlatform(runtime, web);
    depth = 1;
    const push = platform.syncHistory();
    depth = 0;
    const pop = platform.syncHistory();
    await Promise.all([push, pop]);
    expect(
      calls.filter((call) => call.method === 'navigationSetWebHistoryV1').map((call) => call.args),
    ).toEqual([[{ depth: 1 }], [{ depth: 0 }]]);
  });

  it('does not retry native navigation that reports handled:false', async () => {
    host({ capabilities: [capability.push], reply: () => success({ handled: false }) });
    const web = webServices();
    await expect(createPlatform(makeRuntime(), web).navigation.push('/next')).rejects.toMatchObject(
      { code: 'NATIVE_ERROR' },
    );
    expect(web.navigation.push).not.toHaveBeenCalled();
  });

  it('validates sheet inputs and action membership, and aborts web sheets on disposal', async () => {
    host({
      capabilities: [capability.sheet],
      reply: () => success({ status: 'selected', actionId: 'unknown' }),
    });
    const web = webServices();
    const platform = createPlatform(makeRuntime(), web);
    const input = sheetInput;
    await expect(platform.sheets.actions(input)).rejects.toMatchObject({ code: 'NATIVE_ERROR' });
    await expect(
      platform.sheets.actions({ ...input, actions: [input.actions[0], input.actions[0]] }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(web.sheets.actions).not.toHaveBeenCalled();
    const browserRuntime = makeRuntime();
    delete hostWindow.ReactNativeWebView;
    const browser = createPlatform(browserRuntime, web);
    await browser.sheets.actions(input);
    const signal = vi.mocked(web.sheets.actions).mock.calls[0][1]!;
    browser.dispose();
    expect(signal.aborted).toBe(true);
    await expect(browser.sheets.actions(input)).rejects.toBeInstanceOf(BridgeError);
  });
});
