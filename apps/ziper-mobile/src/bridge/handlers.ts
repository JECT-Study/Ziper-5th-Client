import {
  BridgeError,
  capability,
  failure,
  methods,
  providers,
  resultSchema,
  success,
  type BridgeInfo,
  type Input,
  type Method,
  type NativeAuthService,
  type Output,
  type Result,
} from '@ziper/bridge/contract';
import type { ShareInbox } from '../share/inbox';
import { OperationLedger } from './operations';
import { serviceURL, type HostConfig } from './security';
import { SheetSessions } from './sheets';

type AuthMethod = Extract<Method, `auth${string}`>;

export type HostServices = Readonly<{
  auth?: NativeAuthService;
  config: HostConfig;
  platform: 'ios' | 'android';
  appVersion: string;
  active: () => boolean;
  navigate: (kind: 'push' | 'replace', path: string) => void;
  back: () => boolean;
  openExternal?: (url: string) => Promise<void>;
  setDepth: (depth: number) => void;
  sheets: SheetSessions;
  shareInbox?: Pick<ShareInbox, 'read' | 'dismiss'>;
  extraction?: {
    run(input: Input<'extractProductV1'>): Promise<Output<'extractProductV1'>>;
    cancel(): void;
  };
}>;

// Detect stripped extra properties as well as schema failures, including nested objects.
function exactShape(raw: unknown, parsed: unknown): boolean {
  if (Array.isArray(raw) && Array.isArray(parsed))
    return raw.length === parsed.length && raw.every((v, i) => exactShape(v, parsed[i]));
  if (raw && parsed && typeof raw === 'object' && typeof parsed === 'object') {
    const a = raw as Record<string, unknown>,
      b = parsed as Record<string, unknown>;
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((k) => Object.hasOwn(b, k) && exactShape(a[k], b[k]))
    );
  }
  return Object.is(raw, parsed);
}

export function checkedResult<M extends Method>(method: M, value: unknown): Result<Output<M>> {
  const result = resultSchema(methods[method].output).safeParse(value);
  return result.success && exactShape(value, result.data)
    ? (result.data as Result<Output<M>>)
    : failure('INTERNAL');
}

export function validArguments(method: Method, args: unknown[]): boolean {
  const schema = methods[method].input;
  return (
    args.length === (schema.safeParse(undefined).success ? 0 : 1) &&
    schema.safeParse(args[0]).success
  );
}

type Scope = Readonly<{
  host: HostServices;
  operations: OperationLedger;
  /** Whether this scope may still act: not disposed and its screen is active. */
  live: () => boolean;
}>;
type Handler<M extends Method> = (input: Input<M>, scope: Scope) => Promise<unknown> | unknown;
type Feature = {
  /** Omitted when the host always provides it. */
  available?: (host: HostServices) => boolean;
  /** Methods paired with the capability each one adds; null for none. */
  methods: { [M in Method]?: readonly [Handler<M>, capability: string | null] };
};

// Runs a side effect once per operation ID, so a retried request gets the first result.
function once<T>(
  method: Method,
  request: { operationId: string },
  scope: Scope,
  run: () => Result<T> | Promise<Result<T>>,
) {
  return scope.operations.run<T>(
    request.operationId,
    `${method}:${JSON.stringify(request)}`,
    async () => (scope.live() ? run() : failure('PERMISSION_DENIED')),
  );
}

function navigate<M extends 'navigationPushV1' | 'navigationReplaceV1'>(method: M): Handler<M> {
  const kind = method === 'navigationPushV1' ? 'push' : 'replace';
  return (request, scope) => {
    if (!serviceURL(scope.host.config, request.path)) return failure('INVALID_REQUEST');
    return once(method, request, scope, () => {
      scope.host.navigate(kind, request.path);
      return success({ handled: true });
    });
  };
}

// Every non-auth method. Auth runs separately because it serializes provider handoffs.
const features: readonly Feature[] = [
  {
    methods: {
      getBridgeInfoV1: [(_, { host }) => success(bridgeInfo(host)), null],
      navigationPushV1: [navigate('navigationPushV1'), capability.push],
      navigationReplaceV1: [navigate('navigationReplaceV1'), capability.replace],
      // A synchronous pop may dispose this scope; still report the completed navigation.
      navigationBackV1: [(_, { host }) => success({ handled: host.back() }), capability.back],
      navigationSetWebHistoryV1: [
        ({ depth }, { host }) => {
          host.setDepth(depth);
          return success({ done: true });
        },
        capability.history,
      ],
      sheetActionsV1: [
        (request, scope) =>
          once('sheetActionsV1', request, scope, () => scope.host.sheets.open(request)),
        capability.sheet,
      ],
    },
  },
  {
    available: (host) => Boolean(host.shareInbox),
    methods: {
      shareReadV1: [(_, { host }) => success(host.shareInbox!.read()), capability.incomingShare],
      shareDismissV1: [
        ({ id }, { host }) => {
          host.shareInbox!.dismiss(id);
          return success({ done: true });
        },
        null,
      ],
    },
  },
  {
    available: (host) => Boolean(host.openExternal),
    methods: {
      externalOpenV1: [
        (request, scope) =>
          once('externalOpenV1', request, scope, async () => {
            await scope.host.openExternal!(request.url);
            return success({ done: true });
          }),
        capability.external,
      ],
    },
  },
  {
    available: (host) => Boolean(host.extraction),
    methods: {
      extractProductV1: [
        async (input, scope) => {
          const extracted = await scope.host.extraction!.run(input);
          return scope.live() ? success(extracted) : failure('PERMISSION_DENIED');
        },
        capability.productExtraction,
      ],
    },
  },
];

function handlerFor<M extends Method>(host: HostServices, method: M) {
  const feature = features.find((candidate) => Object.hasOwn(candidate.methods, method));
  if (!feature || (feature.available && !feature.available(host))) return null;
  return feature.methods[method]![0] as Handler<M>;
}

export function bridgeInfo(host: HostServices): BridgeInfo {
  const names: Method[] = [];
  const capabilities: string[] = [];
  for (const feature of features) {
    if (feature.available && !feature.available(host)) continue;
    for (const [method, [, name]] of Object.entries(feature.methods)) {
      names.push(method as Method);
      if (name) capabilities.push(name);
    }
  }
  const auth = host.auth;
  if (auth) {
    names.push('authLoginV1', 'authGetWebSessionV1', 'authAdoptWebSessionV1', 'authLogoutV1');
    capabilities.push(
      ...providers.filter((provider) => auth.providers.includes(provider)).map(capability.login),
      capability.restore,
      capability.adopt,
      capability.logout,
    );
    if (auth.openBrowser) {
      names.push('authOpenBrowserV1');
      capabilities.push(capability.browser);
    }
  }
  return {
    protocolVersion: 1,
    platform: host.platform,
    appVersion: host.appVersion,
    methods: names,
    capabilities,
  };
}

async function authCall<M extends AuthMethod>(
  host: HostServices,
  method: M,
  input: Input<M>,
): Promise<Result<Output<M>>> {
  const auth = host.auth;
  if (!auth) return failure('UNSUPPORTED');
  let value: unknown;
  switch (method) {
    case 'authLoginV1':
    case 'authOpenBrowserV1': {
      const request = input as Input<'authLoginV1'>;
      // providers[] describes installed SDKs, not configured browser providers.
      if (method === 'authLoginV1' && !auth.providers.includes(request.provider))
        return failure('UNSUPPORTED');
      if (method === 'authOpenBrowserV1' && !auth.openBrowser) return failure('UNSUPPORTED');
      value =
        method === 'authLoginV1' ? await auth.login(request) : await auth.openBrowser!(request);
      break;
    }
    case 'authGetWebSessionV1':
      value = await auth.restore(input as Input<'authGetWebSessionV1'>);
      break;
    case 'authAdoptWebSessionV1':
      await auth.adopt(input as Input<'authAdoptWebSessionV1'>);
      value = { done: true };
      break;
    case 'authLogoutV1':
      await auth.logout();
      value = { done: true };
      break;
  }
  if (!host.active()) return failure('PERMISSION_DENIED');
  return checkedResult(method, success(value));
}

function authFailure(error: unknown): Result<never> {
  return error instanceof BridgeError &&
    (error.code === 'AUTH_FAILED' ||
      error.code === 'PERMISSION_DENIED' ||
      error.code === 'UNSUPPORTED')
    ? failure(error.code)
    : failure('INTERNAL');
}

export function createHandlers(host: HostServices) {
  const operations = new OperationLedger();
  let disposed = false;
  // Never cache auth handoffs; SDK-wide ordering/idempotency belongs to the service.
  let authBusy = false;
  let authEpoch = 0;

  async function invoke<M extends Method>(
    method: M,
    ...args: Input<M> extends undefined ? [] : [Input<M>]
  ): Promise<Result<Output<M>>> {
    const localState = method === 'getBridgeInfoV1' || method === 'navigationSetWebHistoryV1';
    if (disposed || (!localState && !host.active())) return failure('PERMISSION_DENIED');
    if (!validArguments(method, args)) return failure('INVALID_REQUEST');
    const parsed = methods[method].input.safeParse(args[0]);
    if (!parsed.success) return failure('INVALID_REQUEST');
    const input = parsed.data as Input<M>;
    try {
      if (method.startsWith('auth')) {
        const logout = method === 'authLogoutV1';
        if (!logout && authBusy) return failure('PERMISSION_DENIED');
        if (logout) authEpoch++;
        else authBusy = true;
        const epoch = authEpoch;
        const stale = () => disposed || (!logout && epoch !== authEpoch);
        try {
          const result = await authCall(host, method as AuthMethod, input as Input<AuthMethod>);
          return stale() ? failure('PERMISSION_DENIED') : (result as Result<Output<M>>);
        } catch (error) {
          // Only a typed adapter signal guarantees UNSUPPORTED had no effects.
          return stale() || !host.active() ? failure('PERMISSION_DENIED') : authFailure(error);
        } finally {
          if (!logout) authBusy = false;
        }
      }
      const handle = handlerFor(host, method);
      if (!handle) return failure('UNSUPPORTED');
      const result = await handle(input, {
        host,
        operations,
        live: () => !disposed && host.active(),
      });
      return checkedResult(method, result);
    } catch {
      return failure('INTERNAL');
    }
  }
  return {
    invoke,
    // Blur revokes replies across refocus; cancelling SDK effects remains the service's job.
    suspend() {
      authEpoch++;
      host.extraction?.cancel();
      host.sheets.cancel();
    },
    dispose() {
      disposed = true;
      operations.clear();
      host.extraction?.cancel();
      host.sheets.dispose();
    },
  };
}
