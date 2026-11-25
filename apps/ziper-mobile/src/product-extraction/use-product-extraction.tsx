import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Input, Output } from '@ziper/bridge/contract';
import { isProductExtractionURL } from '@ziper/product-extraction/link';
import { ExtractionJob, type ExtractionView } from './extraction-job';

export function useProductExtraction() {
  const pending = useRef<ExtractionJob | null>(null);
  const sourceVersion = useRef(0);
  const webView = useRef<WebView<unknown>>(null);
  const [view, setView] = useState<ExtractionView | null>(null);
  const extraction = useMemo(
    () => ({
      async run(request: Input<'extractProductV1'>): Promise<Output<'extractProductV1'>> {
        if (!isProductExtractionURL(request.url, true)) return null;
        // In-page Back cancels the web await, not the native load. The next submit owns the view.
        pending.current?.finish(null);
        const job = new ExtractionJob(request, {
          nextVersion: () => ++sourceVersion.current,
          show: setView,
        });
        pending.current = job;
        return job.start();
      },
      cancel: () => pending.current?.finish(null),
    }),
    [],
  );

  if (!view) return { extraction, extractionView: null };
  const { job, version } = view;
  const isCurrent = () => job.isCurrent(version);
  const inject = () => webView.current?.injectJavaScript(job.script);
  const onRendererGone = () => {
    if (isCurrent()) job.rendererGone();
  };
  return {
    extraction,
    extractionView: (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        <WebView
          key={version}
          ref={webView}
          source={{ uri: view.url }}
          originWhitelist={['*']}
          // On Android, incognito clears the process-wide cookie jar, including the app WebView.
          incognito={Platform.OS === 'ios'}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          domStorageEnabled={false}
          cacheEnabled={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows
          onOpenWindow={() => {}}
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          mediaPlaybackRequiresUserAction
          webviewDebuggingEnabled={false}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly
          injectedJavaScriptForMainFrameOnly
          injectedJavaScriptBeforeContentLoaded={job.script}
          injectedJavaScript={job.script}
          onShouldStartLoadWithRequest={({ url, isTopFrame }) =>
            isCurrent() && job.allowNavigation(url, isTopFrame !== false)
          }
          onLoadStart={({ nativeEvent: { url } }) => {
            if (isCurrent() && job.loadStarted(version, url)) inject();
          }}
          onLoadProgress={({ nativeEvent: { url, progress } }) => {
            if (isCurrent() && job.shouldInjectEarly(url, progress)) inject();
          }}
          onLoad={({ nativeEvent: { url } }) => {
            if (isCurrent()) job.loaded(version, url);
          }}
          onMessage={({ nativeEvent }) => {
            if (isCurrent()) job.readMessage(nativeEvent.data, nativeEvent.url);
          }}
          onFileDownload={() => {}}
          onRenderProcessGone={onRendererGone}
          onContentProcessDidTerminate={onRendererGone}
          onError={({ nativeEvent }) => {
            if (isCurrent()) job.loadFailed(nativeEvent);
          }}
          onHttpError={({ nativeEvent: { url, statusCode } }) => {
            // Both native platforms report main-frame errors even before redirect URL updates.
            if (isCurrent()) job.httpFailed(url, statusCode);
          }}
        />
      </View>
    ),
  };
}
