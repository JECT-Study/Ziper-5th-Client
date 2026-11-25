import { bridge, delegate } from '@webview-bridge/react-native';
import { methods, resultSchema } from './contract';

export const nativeBridge = bridge({
  getBridgeInfoV1: delegate({ output: resultSchema(methods.getBridgeInfoV1.output) }),
  authLoginV1: delegate({
    input: methods.authLoginV1.input,
    output: resultSchema(methods.authLoginV1.output),
  }),
  authOpenBrowserV1: delegate({
    input: methods.authOpenBrowserV1.input,
    output: resultSchema(methods.authOpenBrowserV1.output),
  }),
  authGetWebSessionV1: delegate({
    input: methods.authGetWebSessionV1.input,
    output: resultSchema(methods.authGetWebSessionV1.output),
  }),
  authAdoptWebSessionV1: delegate({
    input: methods.authAdoptWebSessionV1.input,
    output: resultSchema(methods.authAdoptWebSessionV1.output),
  }),
  authLogoutV1: delegate({ output: resultSchema(methods.authLogoutV1.output) }),
  navigationPushV1: delegate({
    input: methods.navigationPushV1.input,
    output: resultSchema(methods.navigationPushV1.output),
  }),
  navigationReplaceV1: delegate({
    input: methods.navigationReplaceV1.input,
    output: resultSchema(methods.navigationReplaceV1.output),
  }),
  navigationBackV1: delegate({ output: resultSchema(methods.navigationBackV1.output) }),
  externalOpenV1: delegate({
    input: methods.externalOpenV1.input,
    output: resultSchema(methods.externalOpenV1.output),
  }),
  navigationSetWebHistoryV1: delegate({
    input: methods.navigationSetWebHistoryV1.input,
    output: resultSchema(methods.navigationSetWebHistoryV1.output),
  }),
  extractProductV1: delegate({
    input: methods.extractProductV1.input,
    output: resultSchema(methods.extractProductV1.output),
  }),
  shareReadV1: delegate({ output: resultSchema(methods.shareReadV1.output) }),
  shareDismissV1: delegate({
    input: methods.shareDismissV1.input,
    output: resultSchema(methods.shareDismissV1.output),
  }),
  sheetActionsV1: delegate({
    input: methods.sheetActionsV1.input,
    output: resultSchema(methods.sheetActionsV1.output),
  }),
});

export type NativeBridge = typeof nativeBridge;
