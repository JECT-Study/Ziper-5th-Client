import type { BridgeMiddleware } from '@webview-bridge/react-native';
import { failure, methods, type Method } from '@ziper/bridge/contract';
import { checkedResult, validArguments } from './handlers';
import { allowedDocument, type HostConfig } from './security';

// URL is top-level context, not verified sender origin; enforce frame/script CSP server-side.
export function createHostMiddleware(config: () => HostConfig): BridgeMiddleware {
  return async (request, next) => {
    try {
      if (!allowedDocument(config(), request.url)) return failure('PERMISSION_DENIED');
      if (!Object.hasOwn(methods, request.method)) return failure('UNSUPPORTED');
      const method = request.method as Method;
      if (!validArguments(method, request.args)) return failure('INVALID_REQUEST');
      return checkedResult(method, await next());
    } catch {
      return failure('INTERNAL');
    }
  };
}
