import { linkBridge, MethodNotFoundError } from '@webview-bridge/web';
import type { NativeBridge } from './native';
import {
  BridgeError,
  capability,
  methods,
  providers,
  resultSchema,
  sessionSchema,
  type BridgeInfo,
  type Input,
  type LoginResult,
  type Method,
  type Output,
  type Provider,
  type Runtime,
  type RuntimeStatus,
  type Session,
  type SheetInput,
  type WebAuthService,
  type WebServices,
} from './contract';
import { productExtractionMaxDuration } from '@ziper/product-extraction/link';

export interface RuntimeOptions {
  handshakeTimeoutMs?: number;
  callTimeoutMs?: number;
  interactiveTimeoutMs?: number;
  injectionPollMs?: number;
  injectionGraceMs?: number;
}

// Instance-owned state; never share runtimes between SSR requests.
export function createRuntime(options: RuntimeOptions = {}): Runtime {
  let status: RuntimeStatus = 'initializing';
  let manifest: BridgeInfo | undefined;
  let client: ReturnType<typeof linkBridge<NativeBridge>> | undefined;
  let handshake: Promise<void> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let pollDeadline: ReturnType<typeof setTimeout> | undefined;
  let injectionStarted = false;

  function stopPolling() {
    clearInterval(poll);
    clearTimeout(pollDeadline);
    poll = undefined;
    pollDeadline = undefined;
  }

  const listeners = new Set<() => void>();
  const pending = new Set<AbortController>();
  const setStatus = (next: RuntimeStatus) => {
    if (status === next) return;
    status = next;
    if (next === 'native' || next === 'unavailable' || next === 'closed') stopPolling();
    for (const listener of listeners) listener();
  };
  const hasHost = () =>
    typeof window !== 'undefined' &&
    typeof (window as Window & { ReactNativeWebView?: { postMessage: unknown } }).ReactNativeWebView
      ?.postMessage === 'function';

  async function bounded<T>(
    timeout: number,
    signal: AbortSignal | undefined,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    pending.add(controller);
    const abort = () =>
      controller.abort(
        signal?.reason instanceof BridgeError ? signal.reason : new BridgeError('RESULT_UNKNOWN'),
      );
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(new BridgeError('RESULT_UNKNOWN')), timeout);
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => {
          onAbort = () => reject(controller.signal.reason);
          controller.signal.addEventListener('abort', onAbort, { once: true });
          if (controller.signal.aborted) onAbort();
        }),
        Promise.resolve().then(() => {
          if (controller.signal.aborted) throw controller.signal.reason;
          return work(controller.signal);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onAbort);
      pending.delete(controller);
    }
  }

  async function request<M extends Method>(
    method: M,
    input: Input<M>,
    signal: AbortSignal,
  ): Promise<Output<M>> {
    if (!client) throw new BridgeError('BRIDGE_NOT_READY');
    let raw: unknown;
    try {
      raw = await client.callNative(method, (input === undefined ? [] : [input]) as never, {
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof MethodNotFoundError) throw new BridgeError('UNSUPPORTED');
      throw new BridgeError('NATIVE_ERROR');
    }
    const parsed = resultSchema(methods[method].output).safeParse(raw);
    if (!parsed.success) throw new BridgeError('NATIVE_ERROR');
    if (!parsed.data.ok) throw new BridgeError(parsed.data.error.code);
    return parsed.data.value as Output<M>;
  }

  function initialize(): Promise<void> {
    if (status === 'closed') return Promise.reject(new BridgeError('BRIDGE_CLOSED'));
    if (handshake) return handshake;
    if (status === 'native') return Promise.resolve();
    if (typeof window === 'undefined') {
      setStatus('web');
      return Promise.resolve();
    }
    if (!hasHost()) {
      setStatus('web');
      // One bounded injection window; explicit initialize() can still find a later host.
      if (!injectionStarted) {
        injectionStarted = true;
        const grace = options.injectionGraceMs ?? 3_000;
        if (grace > 0) {
          poll = setInterval(() => {
            if (status === 'web' && hasHost()) void initialize().catch(() => {});
          }, options.injectionPollMs ?? 100);
          pollDeadline = setTimeout(stopPolling, grace);
        }
      }
      return Promise.resolve();
    }
    stopPolling();
    setStatus('initializing');
    client ??= linkBridge<NativeBridge>({ throwOnError: true, timeout: 0 });
    handshake = bounded(options.handshakeTimeoutMs ?? 3_000, undefined, (signal) =>
      request('getBridgeInfoV1', undefined, signal),
    )
      .then(
        (info) => {
          if (status !== 'closed') {
            manifest = info;
            setStatus('native');
          }
        },
        () => {
          if (status !== 'closed') setStatus('unavailable');
        },
      )
      .finally(() => {
        handshake = undefined;
      });
    return handshake;
  }

  return {
    get status() {
      return status;
    },
    initialize,
    supports(cap, method) {
      return (
        status === 'native' &&
        !!manifest?.capabilities.includes(cap) &&
        manifest.methods.includes(method)
      );
    },
    async invoke(method, input, callOptions = {}) {
      if (status === 'closed') throw new BridgeError('BRIDGE_CLOSED');
      const parsed = methods[method].input.safeParse(input);
      if (!parsed.success) throw new BridgeError('INVALID_REQUEST');
      const timeout =
        method === 'getBridgeInfoV1'
          ? (options.handshakeTimeoutMs ?? 3_000)
          : method === 'authLoginV1' ||
              method === 'authOpenBrowserV1' ||
              method === 'sheetActionsV1' ||
              method === 'externalOpenV1'
            ? (options.interactiveTimeoutMs ?? 180_000)
            : (options.callTimeoutMs ?? 5_000);
      return bounded(callOptions.timeoutMs ?? timeout, callOptions.signal, async (signal) => {
        await initialize();
        if (signal.aborted) throw signal.reason;
        if (status === 'closed') throw new BridgeError('BRIDGE_CLOSED');
        if (status === 'web') throw new BridgeError('UNSUPPORTED');
        if (status !== 'native') throw new BridgeError('BRIDGE_NOT_READY');
        if (!manifest?.methods.includes(method)) throw new BridgeError('UNSUPPORTED');
        return request(method, parsed.data as Input<typeof method>, signal);
      });
    },
    subscribe(listener) {
      if (status === 'closed') return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (status === 'closed') return;
      stopPolling();
      for (const controller of pending) controller.abort(new BridgeError('BRIDGE_CLOSED'));
      client?.dispose();
      manifest = undefined;
      setStatus('closed');
      listeners.clear();
    },
  };
}

const isUnsupported = (error: unknown) =>
  error instanceof BridgeError && error.code === 'UNSUPPORTED';

export function createPlatform(runtime: Runtime, web: WebServices) {
  let closed = false;
  let authEpoch = 0;
  let sheetBusy = false;
  let loginBusy = false;
  let logoutBusy = 0;
  const lifetime = new AbortController();
  let historySync = Promise.resolve();
  const check = () => {
    if (closed) throw new BridgeError('BRIDGE_CLOSED');
  };
  const checkAuth = (epoch: number) => {
    check();
    if (epoch !== authEpoch || logoutBusy > 0) throw new BridgeError('AUTH_FAILED');
  };
  const auth = () => {
    check();
    if (!web.auth) throw new BridgeError('AUTH_NOT_CONFIGURED');
    return web.auth;
  };
  const session = (value: unknown): Session => {
    const parsed = sessionSchema.safeParse(value);
    if (!parsed.success) throw new BridgeError('AUTH_FAILED');
    return parsed.data;
  };

  async function native<M extends Method>(
    cap: string,
    method: M,
    input: Input<M>,
  ): Promise<Output<M>> {
    check();
    await runtime.initialize();
    check();
    if (runtime.status === 'closed') throw new BridgeError('BRIDGE_CLOSED');
    if (runtime.status !== 'web' && runtime.status !== 'native')
      throw new BridgeError('BRIDGE_NOT_READY');
    if (!runtime.supports(cap, method)) throw new BridgeError('UNSUPPORTED');
    const result = await runtime.invoke(method, input, { signal: lifetime.signal });
    check();
    return result;
  }

  async function fallback<N, W>(
    attempt: () => Promise<N>,
    webAction: () => Promise<W>,
  ): Promise<N | W> {
    try {
      return await attempt();
    } catch (error) {
      if (!isUnsupported(error)) throw error;
    }
    check();
    const result = await webAction();
    check();
    return result;
  }

  async function adopt(service: WebAuthService, epoch: number) {
    checkAuth(epoch);
    if (!runtime.supports(capability.adopt, 'authAdoptWebSessionV1')) return;
    const handoff = await service.session.nativeHandoff();
    checkAuth(epoch);
    await fallback(
      () => native(capability.adopt, 'authAdoptWebSessionV1', handoff),
      async () => {},
    );
    checkAuth(epoch);
  }

  // Unlike randomUUID, getRandomValues also works on development HTTP origins.
  const operationId = () => globalThis.crypto.getRandomValues(new Uint32Array(4)).join('-');
  const navigate = async (
    method: 'navigationPushV1' | 'navigationReplaceV1',
    cap: string,
    path: string,
    action: () => Promise<void>,
  ) => {
    check();
    const input = { path, operationId: operationId() };
    if (!methods[method].input.safeParse(input).success) throw new BridgeError('INVALID_REQUEST');
    await fallback(
      async () => {
        const result = await native(cap, method, input);
        if (!result.handled) throw new BridgeError('NATIVE_ERROR');
      },
      async () => {
        await action();
        await syncHistory();
      },
    );
  };

  async function syncHistory() {
    check();
    if (!runtime.supports(capability.history, 'navigationSetWebHistoryV1')) return;
    const depth = web.navigation.depth();
    // Preserve browser event ordering even if native replies arrive out of order.
    historySync = historySync
      .catch(() => {})
      .then(async () => {
        check();
        await fallback(
          () => runtime.invoke('navigationSetWebHistoryV1', { depth }, { signal: lifetime.signal }),
          async () => {},
        );
      });
    await historySync;
  }
  return {
    auth: {
      async login(provider: Provider): Promise<Session | { status: 'cancelled' }> {
        const service = auth();
        if (!providers.includes(provider)) throw new BridgeError('INVALID_REQUEST');
        if (loginBusy || logoutBusy > 0) throw new BridgeError('AUTH_FAILED');
        loginBusy = true;
        const epoch = ++authEpoch;
        try {
          const webLogin = async () => {
            // Call the adapter before any await in an ordinary browser, preserving its popup/redirect seam.
            const webResult = await service.login({ provider });
            checkAuth(epoch);
            if (webResult.status === 'cancelled') return webResult;
            const signedIn = session(webResult);
            await adopt(service, epoch);
            checkAuth(epoch);
            return signedIn;
          };
          const initialization = runtime.initialize();
          if (runtime.status === 'web') return await webLogin();
          await initialization;
          checkAuth(epoch);
          let transaction: { transactionId: string } | undefined;
          const attempt = async (
            cap: string,
            method: 'authLoginV1' | 'authOpenBrowserV1',
          ): Promise<LoginResult | undefined> => {
            if (
              runtime.status === 'web' ||
              (runtime.status === 'native' && !runtime.supports(cap, method))
            )
              return undefined;
            if (runtime.status !== 'native') throw new BridgeError('BRIDGE_NOT_READY');
            transaction ??= await service.session.createTransaction();
            checkAuth(epoch);
            // Catch ONLY the native no-effects result, never backend transaction/exchange errors.
            try {
              return await native(cap, method, {
                provider,
                transactionId: transaction.transactionId,
              });
            } catch (error) {
              if (!isUnsupported(error)) throw error;
            }
          };
          const result =
            (await attempt(capability.login(provider), 'authLoginV1')) ??
            (await attempt(capability.browser, 'authOpenBrowserV1'));
          checkAuth(epoch);
          if (result) {
            if (result.status === 'cancelled') return result;
            const exchanged = await service.session.exchange({
              transactionId: transaction!.transactionId,
              handoffCode: result.handoffCode,
            });
            checkAuth(epoch);
            return session(exchanged);
          }
          return await webLogin();
        } finally {
          loginBusy = false;
        }
      },
      async restore(): Promise<Session | null> {
        const service = auth();
        const epoch = authEpoch;
        checkAuth(epoch);
        await runtime.initialize();
        checkAuth(epoch);
        if (runtime.status !== 'web' && runtime.status !== 'native')
          throw new BridgeError('BRIDGE_NOT_READY');
        if (runtime.supports(capability.restore, 'authGetWebSessionV1')) {
          const transaction = await service.session.createTransaction();
          checkAuth(epoch);
          const result = await fallback(
            () => native(capability.restore, 'authGetWebSessionV1', transaction),
            async () => ({ handoffCode: null }),
          );
          checkAuth(epoch);
          if (result.handoffCode !== null) {
            const exchanged = await service.session.exchange({
              ...transaction,
              handoffCode: result.handoffCode,
            });
            checkAuth(epoch);
            return session(exchanged);
          }
        }
        const current = await service.session.current();
        checkAuth(epoch);
        if (current === null) return null;
        const restored = session(current);
        await adopt(service, epoch);
        checkAuth(epoch);
        return restored;
      },
      async logout(): Promise<void> {
        const service = auth();
        authEpoch++;
        logoutBusy++;
        try {
          // Independent cleanup: a failed/unknown native outcome must never retain the web cookie.
          const results = await Promise.allSettled([
            fallback(
              () => native(capability.logout, 'authLogoutV1', undefined),
              async () => {},
            ),
            (async () => service.session.logout())(),
          ]);
          check();
          const failures = results.filter((result) => result.status === 'rejected');
          if (failures.length === 1) throw failures[0].reason;
          if (failures.length > 1)
            throw new AggregateError(
              failures.map((result) => result.reason),
              'Logout failed',
            );
        } finally {
          logoutBusy--;
        }
      },
    },
    navigation: {
      push: (path: string) =>
        navigate('navigationPushV1', capability.push, path, () => web.navigation.push(path)),
      replace: (path: string) =>
        navigate('navigationReplaceV1', capability.replace, path, () =>
          web.navigation.replace(path),
        ),
      async back() {
        await fallback(
          async () => {
            const result = await native(capability.back, 'navigationBackV1', undefined);
            if (!result.handled) throw new BridgeError('NATIVE_ERROR');
          },
          async () => {
            await web.navigation.back();
            await syncHistory();
          },
        );
      },
    },
    external: {
      async open(url: string) {
        check();
        const input = { url, operationId: operationId() };
        if (!methods.externalOpenV1.input.safeParse(input).success)
          throw new BridgeError('INVALID_REQUEST');
        // Keep the browser popup in the user's click stack; never fallback inside a WebView.
        if (runtime.status === 'web') {
          if (!web.openExternal) throw new BridgeError('UNSUPPORTED');
          await web.openExternal(url);
          check();
          return;
        }
        await native(capability.external, 'externalOpenV1', input);
      },
    },
    async extractProduct(input: Input<'extractProductV1'>, signal: AbortSignal) {
      check();
      await runtime.initialize();
      check();
      if (!runtime.supports(capability.productExtraction, 'extractProductV1')) return null;
      return runtime.invoke('extractProductV1', input, {
        signal,
        timeoutMs: productExtractionMaxDuration(input.url) + 1_000,
      });
    },
    incomingShare: {
      read() {
        return fallback(
          () => native(capability.incomingShare, 'shareReadV1', undefined),
          async () => null,
        );
      },
      dismiss(id: string) {
        return native(capability.incomingShare, 'shareDismissV1', { id });
      },
    },
    sheets: {
      async actions(input: Omit<SheetInput, 'operationId'>) {
        check();
        const parsed = methods.sheetActionsV1.input.safeParse({
          ...input,
          operationId: operationId(),
        });
        if (!parsed.success) throw new BridgeError('INVALID_REQUEST');
        // Lock before negotiation so late native injection can't stack sheets.
        if (sheetBusy) throw new BridgeError('PERMISSION_DENIED');
        sheetBusy = true;
        try {
          const scope = web.sheets.getScope?.();
          const value = await fallback(
            () => native(capability.sheet, 'sheetActionsV1', parsed.data),
            () =>
              scope === web.sheets.getScope?.()
                ? web.sheets.actions(parsed.data, lifetime.signal)
                : Promise.resolve({ status: 'cancelled' as const }),
          );
          const output = methods.sheetActionsV1.output.safeParse(value);
          if (!output.success) throw new BridgeError('NATIVE_ERROR');
          const selected = output.data;
          if (
            selected.status === 'selected' &&
            !parsed.data.actions.some((action) => action.id === selected.actionId)
          )
            throw new BridgeError('NATIVE_ERROR');
          return selected;
        } finally {
          sheetBusy = false;
        }
      },
    },
    syncHistory,
    dispose() {
      if (closed) return;
      closed = true;
      lifetime.abort(new BridgeError('BRIDGE_CLOSED'));
    },
  };
}

export type Platform = ReturnType<typeof createPlatform>;
