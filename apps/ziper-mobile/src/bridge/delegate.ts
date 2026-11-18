import type { BridgeDelegate } from '@webview-bridge/react-native';
import type { NativeBridge } from '@ziper/bridge/native';
import type { createHandlers } from './handlers';

export function createDelegate(
  invoke: ReturnType<typeof createHandlers>['invoke'],
): BridgeDelegate<NativeBridge> {
  return {
    getBridgeInfoV1: () => invoke('getBridgeInfoV1'),
    authLoginV1: (input) => invoke('authLoginV1', input),
    authOpenBrowserV1: (input) => invoke('authOpenBrowserV1', input),
    authGetWebSessionV1: (input) => invoke('authGetWebSessionV1', input),
    authAdoptWebSessionV1: (input) => invoke('authAdoptWebSessionV1', input),
    authLogoutV1: () => invoke('authLogoutV1'),
    navigationPushV1: (input) => invoke('navigationPushV1', input),
    navigationReplaceV1: (input) => invoke('navigationReplaceV1', input),
    navigationBackV1: () => invoke('navigationBackV1'),
    navigationSetWebHistoryV1: (input) => invoke('navigationSetWebHistoryV1', input),
    sheetActionsV1: (input) => invoke('sheetActionsV1', input),
    shareReadV1: () => invoke('shareReadV1'),
    shareDismissV1: (input) => invoke('shareDismissV1', input),
  };
}
