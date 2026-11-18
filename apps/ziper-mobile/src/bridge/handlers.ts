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
  setDepth: (depth: number) => void;
  sheets: SheetSessions;
  shareInbox?: Pick<ShareInbox, 'read' | 'dismiss'>;
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

export function bridgeInfo(host: HostServices): BridgeInfo {
  const names: Method[] = [
    'getBridgeInfoV1',
    'navigationPushV1',
    'navigationReplaceV1',
    'navigationBackV1',
    'navigationSetWebHistoryV1',
    'sheetActionsV1',
  ];
  const capabilities: string[] = [
    capability.push,
    capability.replace,
    capability.back,
    capability.history,
    capability.sheet,
  ];
  if (host.shareInbox) {
    names.push('shareReadV1', 'shareDismissV1');
    capabilities.push(capability.incomingShare);
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
      let result: unknown;
      switch (method) {
        case 'getBridgeInfoV1':
          result = success(bridgeInfo(host));
          break;
        // A synchronous pop may dispose this scope; still report the completed navigation.
        case 'navigationBackV1':
          result = success({ handled: host.back() });
          break;
        case 'navigationSetWebHistoryV1':
          host.setDepth((input as Input<'navigationSetWebHistoryV1'>).depth);
          result = success({ done: true });
          break;
        case 'navigationPushV1':
        case 'navigationReplaceV1': {
          const request = input as Input<'navigationPushV1'>;
          if (!serviceURL(host.config, request.path)) return failure('INVALID_REQUEST');
          result = await operations.run(
            request.operationId,
            `${method}:${JSON.stringify(input)}`,
            async () => {
              if (disposed || !host.active()) return failure('PERMISSION_DENIED');
              host.navigate(method === 'navigationPushV1' ? 'push' : 'replace', request.path);
              return success({ handled: true });
            },
          );
          break;
        }
        case 'shareReadV1':
          if (!host.shareInbox) return failure('UNSUPPORTED');
          result = success(host.shareInbox.read());
          break;
        case 'shareDismissV1':
          if (!host.shareInbox) return failure('UNSUPPORTED');
          host.shareInbox.dismiss((input as Input<'shareDismissV1'>).id);
          result = success({ done: true });
          break;
        case 'sheetActionsV1': {
          const request = input as Input<'sheetActionsV1'>;
          result = await operations.run(
            request.operationId,
            `${method}:${JSON.stringify(input)}`,
            () =>
              disposed || !host.active()
                ? Promise.resolve(failure('PERMISSION_DENIED'))
                : host.sheets.open(request),
          );
          break;
        }
      }
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
      host.sheets.cancel();
    },
    dispose() {
      disposed = true;
      operations.clear();
      host.sheets.dispose();
    },
  };
}
