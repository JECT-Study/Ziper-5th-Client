import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Input, Output } from '@ziper/bridge/contract';
import { isProductExtractionURL } from '@ziper/product-extraction/link';
import { startExtraction, type ExtractionView, type Job } from './extraction-job';

export function useProductExtraction() {
  const pending = useRef<Job | null>(null);
  const sourceVersion = useRef(0);
  const webView = useRef<WebView<unknown>>(null);
  const [view, setView] = useState<ExtractionView | null>(null);
  const extraction = useMemo(
    () => ({
      async run(request: Input<'extractProductV1'>): Promise<Output<'extractProductV1'>> {
        if (!isProductExtractionURL(request.url, true)) return null;
        // In-page Back cancels the web await, not the native load. The next submit owns the view.
        pending.current?.finish(null);
        return startExtraction(request, {
          pending,
          nextVersion: () => ++sourceVersion.current,
          show: setView,
        });
      },
      cancel: () => pending.current?.finish(null),
    }),
    [],
  );

  const job = view?.job;
  const isCurrent = () =>
    view && pending.current === view.job && view.version === view.job.sourceVersion;
  const onRendererGone = () => {
    if (isCurrent()) job?.rendererGone();
  };
  return {
    extraction,
    extractionView: job && view && (
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        <WebView
          key={view.version}
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
          onShouldStartLoadWithRequest={({ url, isTopFrame }) => {
            return Boolean(isCurrent() && job.allowNavigation(url, isTopFrame !== false));
          }}
          onLoadStart={({ nativeEvent: { url } }) => {
            if (!isCurrent()) return;
            const earlyInjection = job.pageURL !== url && job.injectedAtURL === url;
            job.updatePage(url);
            // Android emits this from doUpdateVisitedHistory, before a slow page finishes loading.
            if (Platform.OS === 'android' && isCurrent()) job.allowLateProductTime(url);
            // Progress can inject into the previous document; the scan is idempotent here.
            if (earlyInjection && isCurrent()) webView.current?.injectJavaScript(job.script);
          }}
          onLoadProgress={({ nativeEvent: { url, progress } }) => {
            if (isCurrent() && job.shouldInjectEarly(url, progress))
              webView.current?.injectJavaScript(job.script);
          }}
          // Some Android redirects only report the final URL at load finish.
          onLoad={({ nativeEvent }) => {
            if (!isCurrent()) return;
            job.updatePage(nativeEvent.url);
            if (isCurrent()) job.allowLateProductTime(nativeEvent.url);
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
