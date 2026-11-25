import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  ablyAirbridgeProductURL,
  ablyAppProductURL,
  alternateProductExtractionURL,
  canonicalProductExtractionURL,
  isProductExtractionURL,
  productExtractionMaxDuration,
  productExtractionTimeout,
  productShortLinkShop,
  zigzagAffiliateProductURL,
  type Input,
  type Output,
} from '@ziper/bridge/contract';
import { metadataScript } from './metadata-script';
import { musinsaAppProductURL } from './musinsa-app-link';
import { productDocumentURL, readProductMessage } from './product-message';

type Request = Input<'extractProductV1'>;
type Metadata = Output<'extractProductV1'>;

// Preserve one snapshot, not a mix of fields from different samples.
function addsOrChangesFields(sample: NonNullable<Metadata>, previous: Metadata | undefined) {
  return (
    !previous ||
    (sample.name !== '' && sample.name !== previous.name) ||
    (sample.price !== null && sample.price !== previous.price) ||
    (sample.imageURL !== null && sample.imageURL !== previous.imageURL)
  );
}

const musinsaRedirectGraceMs = 2_000;
const minRetryTimeMs = 1_500;
const shortLinkProductWindowMs = 6_000;
type LoadError = { url: string; code: number; domain?: string };

function isTransientLoadError({ code, domain }: LoadError) {
  // Both platforms expose distinct codes for timeouts, connection failures and I/O interruptions.
  return Platform.OS === 'ios'
    ? domain === 'NSURLErrorDomain' && [-1001, -1004, -1005].includes(code)
    : [-6, -7, -8].includes(code);
}

type Job = {
  sourceVersion: number;
  sourceURL: string;
  pageURL: string;
  script: string;
  injectedAtURL: string | null;
  best: Metadata;
  canLoad: (url: string) => boolean;
  allowNavigation: (url: string, isTopFrame: boolean) => boolean;
  updatePage: (url: string) => void;
  allowLateProductTime: (url: string) => void;
  readMessage: (data: string, origin: string) => void;
  loadFailed: (error: LoadError) => void;
  httpFailed: (url: string, status: number) => void;
  rendererGone: () => void;
  finish: (result: Metadata) => void;
};

export function useProductExtraction() {
  const pending = useRef<Job | null>(null);
  const sourceVersion = useRef(0);
  const webView = useRef<WebView<unknown>>(null);
  const [view, setView] = useState<{ job: Job; url: string; version: number } | null>(null);
  const extraction = useMemo(
    () => ({
      async run(request: Request): Promise<Metadata> {
        if (!isProductExtractionURL(request.url, true)) return null;
        // In-page Back cancels the web await, not the native load. The next submit owns the view.
        pending.current?.finish(null);
        const sourceURL = alternateProductExtractionURL(request.url) ?? request.url;
        let expectedProduct = canonicalProductExtractionURL(request.url);
        const { hostname: host, pathname } = new URL(request.url);
        const shortLinkShop = productShortLinkShop(request.url);
        const maxDuration = productExtractionMaxDuration(request.url);
        const shortLinkDestination = (url: string) => {
          if (host === 'applink.a-bly.com') return ablyAirbridgeProductURL(url);
          return host === 's.zigzag.kr' && pathname.startsWith('/abr/')
            ? zigzagAffiliateProductURL(url)
            : null;
        };
        return new Promise((resolve) => {
          const startedAt = Date.now();
          const initialDeadline = startedAt + productExtractionTimeout;
          let deadline = initialDeadline;
          // Late hydration can extend the wait for data, not the window for another request.
          let retryDeadline = initialDeadline;
          const extendDeadline = (limit: number, now: number) => {
            if (now >= deadline || limit <= deadline) return;
            deadline = limit;
            clearTimeout(timer);
            timer = setTimeout(() => next.finish(next.best), deadline - now);
          };
          const confirmProduct = (url: string) => {
            if (expectedProduct) return;
            expectedProduct = canonicalProductExtractionURL(url);
            if (!expectedProduct || !shortLinkShop) return;
            const now = Date.now();
            extendDeadline(Math.min(startedAt + maxDuration, now + shortLinkProductWindowMs), now);
            retryDeadline = deadline;
          };
          let appFallback: ReturnType<typeof setTimeout> | undefined;
          let webProductStarted = false;
          let retriedLoad = false;
          const deferredMessages = new Map<
            string,
            { data: string; origin: string; metadata: NonNullable<Metadata> }
          >();
          const markWebProduct = (url: string) => {
            if (!canonicalProductExtractionURL(url)) return;
            webProductStarted = true;
            clearTimeout(appFallback);
          };
          const replaceSource = (url: string, retry = false) => {
            if (pending.current !== next || (!retry && next.sourceURL === url)) return;
            markWebProduct(url);
            confirmProduct(url);
            next.sourceURL = url;
            next.pageURL = url;
            next.injectedAtURL = null;
            next.best = null;
            deferredMessages.clear();
            next.sourceVersion = ++sourceVersion.current;
            setView({ job: next, url, version: next.sourceVersion });
          };
          const replaceAlternate = (url: string) => {
            const alternate = shortLinkDestination(url) ?? alternateProductExtractionURL(url);
            if (!alternate) return false;
            replaceSource(alternate);
            return true;
          };
          const retryProductPage = (url = next.pageURL) => {
            // Never reopen a short link or an unconfirmed destination after a failure.
            if (
              !retriedLoad &&
              expectedProduct &&
              /^https:\/\//i.test(url) &&
              canonicalProductExtractionURL(url) === expectedProduct &&
              !ablyAppProductURL(new URL(url)) &&
              !alternateProductExtractionURL(url) &&
              retryDeadline - Date.now() >= minRetryTimeMs
            ) {
              retriedLoad = true;
              replaceSource(url, true);
            } else next.finish(null);
          };
          const next: Job = {
            sourceVersion: ++sourceVersion.current,
            sourceURL,
            pageURL: sourceURL,
            script: metadataScript(request.shops, maxDuration),
            injectedAtURL: null,
            best: null,
            allowLateProductTime(url) {
              const now = Date.now();
              // A late Ably document can still hydrate its metadata. Do not reload it.
              if (
                expectedProduct?.startsWith('https://m.a-bly.com/goods/') &&
                now >= initialDeadline - 3_000 &&
                /^https:\/\//i.test(url) &&
                canonicalProductExtractionURL(url) === expectedProduct &&
                !ablyAppProductURL(new URL(url))
              ) {
                extendDeadline(startedAt + maxDuration, now);
              }
            },
            canLoad(url) {
              const product = shortLinkDestination(url) ?? canonicalProductExtractionURL(url);
              if (product) {
                return expectedProduct
                  ? product === expectedProduct
                  : new URL(product).hostname === shortLinkShop;
              }
              return (
                !expectedProduct &&
                isProductExtractionURL(url, true) &&
                new URL(url).hostname === host
              );
            },
            allowNavigation(url, isTopFrame) {
              if (pending.current !== next) return false;
              if (
                isTopFrame &&
                host === 'musinsa.onelink.me' &&
                !webProductStarted &&
                !appFallback
              ) {
                const product = musinsaAppProductURL(url);
                // Keep OneLink's HTTPS navigation if it arrives. The app target is only a backup.
                if (product)
                  appFallback = setTimeout(() => replaceSource(product), musinsaRedirectGraceMs);
              }
              if (!next.canLoad(url)) return false;
              if (!isTopFrame) return /^https:\/\//i.test(url);
              markWebProduct(url);
              return !replaceAlternate(url);
            },
            updatePage(url) {
              if (pending.current !== next || url === 'about:blank') return;
              if (!next.canLoad(url)) return next.finish(null);
              markWebProduct(url);
              if (replaceAlternate(url)) return;
              // Once a short link commits to a product, don't switch to another product on the same shop.
              confirmProduct(url);
              if (url === next.pageURL) return;
              const key = productDocumentURL(url).href;
              const sameDocument = key === productDocumentURL(next.pageURL).href;
              next.pageURL = url;
              if (sameDocument) return;
              // A query change can select another option of the same product.
              next.best = null;
              const candidate = deferredMessages.get(key);
              if (candidate) {
                deferredMessages.delete(key);
                next.readMessage(candidate.data, candidate.origin);
              }
            },
            readMessage(data, origin) {
              if (pending.current !== next || data.length > 8_000) return;
              const requested = expectedProduct ?? next.sourceURL;
              const result = readProductMessage(
                data,
                origin,
                next.pageURL,
                request.shops,
                requested,
              );
              if (!result) {
                const candidate = readProductMessage(data, origin, null, request.shops, requested);
                if (candidate && next.canLoad(candidate.documentURL)) {
                  const key = candidate.documentURL;
                  if (!addsOrChangesFields(candidate.metadata, deferredMessages.get(key)?.metadata))
                    return;
                  deferredMessages.delete(key);
                  deferredMessages.set(key, { data, origin, metadata: candidate.metadata });
                  const oldest = deferredMessages.keys().next().value;
                  if (deferredMessages.size > 4 && oldest) deferredMessages.delete(oldest);
                }
                return;
              }
              // A previously committed document can still report a partial snapshot during redirect.
              const { metadata, complete } = result;
              if (complete) return next.finish(metadata);
              if (addsOrChangesFields(metadata, next.best)) next.best = metadata;
            },
            loadFailed(error) {
              // WKWebView can report no current URL if the top-level load failed before commit.
              const url = error.url || (Platform.OS === 'ios' ? next.pageURL : '');
              if (url === next.pageURL && isTransientLoadError(error)) retryProductPage();
              else next.finish(null);
            },
            httpFailed(url, status) {
              // Gateway failures can be transient; never retry denial or rate limiting.
              if (url && (status === 502 || status === 504)) retryProductPage(url);
              else next.finish(null);
            },
            rendererGone: retryProductPage,
            finish(result) {
              if (pending.current !== next) return;
              clearTimeout(timer);
              clearTimeout(appFallback);
              pending.current = null;
              setView(null);
              resolve(result);
            },
          };
          let timer = setTimeout(() => next.finish(next.best), productExtractionTimeout);
          pending.current = next;
          setView({ job: next, url: next.sourceURL, version: next.sourceVersion });
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
            // The product may already be readable while Android still reports the short link.
            // Injection does not confirm navigation; readMessage still waits for updatePage.
            if (
              isCurrent() &&
              progress >= 0.3 &&
              url &&
              url !== job.injectedAtURL &&
              /^https:\/\//i.test(url) &&
              canonicalProductExtractionURL(url) &&
              job.canLoad(url)
            ) {
              job.injectedAtURL = url;
              webView.current?.injectJavaScript(job.script);
            }
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
