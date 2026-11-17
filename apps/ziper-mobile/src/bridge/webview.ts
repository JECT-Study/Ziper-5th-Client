import { createWebView } from '@webview-bridge/react-native';
import { nativeBridge } from '@ziper/bridge/native';
import { createHostMiddleware } from './middleware';
import { configuredHost } from './services';

Object.freeze(nativeBridge.getState());
nativeBridge.use(createHostMiddleware(configuredHost));
export const { WebView } = createWebView({ bridge: nativeBridge, debug: false });
