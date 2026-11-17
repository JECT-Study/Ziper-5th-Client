import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { Window } from 'happy-dom';
import type * as Native from '@webview-bridge/react-native';
import type * as Web from '@webview-bridge/web';
import type { NativeBridge } from '../src/native';
import * as contract from '../src/contract';

const require = createRequire(import.meta.url);

const nativePath = require.resolve('@webview-bridge/react-native');

const webPath = require.resolve('@webview-bridge/web');

interface FixtureOptions {
  delegate?: Native.BridgeDelegate<NativeBridge>;
  middleware?: Native.BridgeMiddleware;
}

// Runs patched CommonJS bridge artifacts with a mocked native view.
export async function mountWebView(
  methods: Record<string, (...args: any[]) => Promise<unknown>>,
  drop: (script: string) => boolean = () => false,
  options: FixtureOptions = {},
) {
  let closed = false;
  let onMessage: ((event: any) => Promise<void>) | undefined;
  let props: any;
  const injections: string[] = [];
  const nativeExports = {};
  const nativeRequire = createRequire(nativePath);

  function page() {
    const window = new Window({ url: 'https://app.example.test' });
    const exports = {};
    window.eval('(function(exports, require){' + readFileSync(webPath, 'utf8') + '\n})')(
      exports,
      createRequire(webPath),
    );
    Object.assign(window, {
      ReactNativeWebView: {
        postMessage(data: string) {
          queueMicrotask(() => {
            if (!closed) void onMessage?.({ nativeEvent: { data, url: window.location.href } });
          });
        },
      },
    });
    return { window, web: exports as typeof Web };
  }

  let currentPage = page();
  const inject = (source: string) => {
    if (closed) return;
    injections.push(source);
    if (!drop(source)) currentPage.window.eval(source);
  };
  const Primitive = forwardRef<any, any>((nextProps, ref) => {
    useImperativeHandle(ref, () => ({ injectJavaScript: inject }), []);
    useLayoutEffect(() => {
      props = nextProps;
      onMessage = props.onMessage;
      props.onLoadStart?.({ nativeEvent: { url: currentPage.window.location.href } });
      inject(props.injectedJavaScriptBeforeContentLoaded);
      inject(props.injectedJavaScript);
      return () => {
        onMessage = undefined;
      };
    }, []);
    return null;
  });
  new Function('exports', 'require', readFileSync(nativePath, 'utf8'))(
    nativeExports,
    (name: string) => (name === 'react-native-webview' ? Primitive : nativeRequire(name)),
  );
  const native = nativeExports as typeof Native;
  let store: ReturnType<typeof native.bridge>;
  if (options.delegate) {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../src/native.ts'),
      'utf8',
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports: any = {};
    new Function('exports', 'require', compiled)(exports, (name: string) =>
      name === '@webview-bridge/react-native'
        ? native
        : name === './contract'
          ? contract
          : nativeRequire(name),
    );
    store = exports.nativeBridge;
  } else {
    store = native.bridge(methods);
  }
  if (options.middleware) store.use(options.middleware);
  const { WebView } = native.createWebView({ bridge: store });
  const container = document.createElement('div');
  document.body.append(container);
  const renderer: Root = createRoot(container);
  const global = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const close = () => {
    if (closed) return;
    closed = true;
    const before = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      act(() => renderer.unmount());
    } finally {
      global.IS_REACT_ACT_ENVIRONMENT = before;
      container.remove();
      void currentPage.window.happyDOM.close();
    }
  };
  const before = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      renderer.render(
        React.createElement(WebView as React.ComponentType<any>, { delegate: options.delegate }),
      );
    });
  } catch (error) {
    close();
    throw error;
  } finally {
    global.IS_REACT_ACT_ENVIRONMENT = before;
  }
  return {
    get window() {
      return currentPage.window;
    },
    get web() {
      return currentPage.web;
    },
    native,
    injections,
    async sendRaw(data: string) {
      await onMessage?.({ nativeEvent: { data, url: currentPage.window.location.href } });
    },
    async flush() {
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    historyChange() {
      props.onLoadStart?.({ nativeEvent: { url: currentPage.window.location.href + '/detail' } });
    },
    replaceDocument() {
      const previous = currentPage;
      currentPage = page();
      props.onLoadStart?.({ nativeEvent: { url: currentPage.window.location.href } });
      inject(props.injectedJavaScriptBeforeContentLoaded);
      inject(props.injectedJavaScript);
      void previous.window.happyDOM.close();
    },
    close,
  };
}
