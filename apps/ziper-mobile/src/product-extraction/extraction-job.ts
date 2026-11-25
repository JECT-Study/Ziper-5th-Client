import { Platform } from 'react-native';
import {
  ablyAppProductURL,
  alternateProductExtractionURL,
  canonicalProductExtractionURL,
  isProductExtractionURL,
  musinsaAppProductURL,
  productExtractionMaxDuration,
  productExtractionTimeout,
  productShortLinkShop,
  shortLinkRedirectProductURL,
} from '@ziper/product-extraction/link';
import { productDocumentURL, readProductMessage } from '@ziper/product-extraction/message';
import { productScanScript } from '@ziper/product-extraction/scanner';
import type { ProductMetadata, Shops } from '@ziper/product-extraction/schema';

type Request = { url: string; shops: Shops };
type Metadata = ProductMetadata | null;

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
const isHttps = (url: string) => /^https:\/\//i.test(url);
type LoadError = { url: string; code: number; domain?: string };

function isTransientLoadError({ code, domain }: LoadError) {
  // Both platforms expose distinct codes for timeouts, connection failures and I/O interruptions.
  return Platform.OS === 'ios'
    ? domain === 'NSURLErrorDomain' && [-1001, -1004, -1005].includes(code)
    : [-6, -7, -8].includes(code);
}

export type Job = {
  sourceVersion: number;
  sourceURL: string;
  pageURL: string;
  script: string;
  injectedAtURL: string | null;
  best: Metadata;
  canLoad: (url: string) => boolean;
  // The product may already be readable while Android still reports the short link.
  // Injection does not confirm navigation; readMessage still waits for updatePage.
  shouldInjectEarly: (url: string, progress: number) => boolean;
  allowNavigation: (url: string, isTopFrame: boolean) => boolean;
  updatePage: (url: string) => void;
  allowLateProductTime: (url: string) => void;
  readMessage: (data: string, origin: string) => void;
  loadFailed: (error: LoadError) => void;
  httpFailed: (url: string, status: number) => void;
  rendererGone: () => void;
  finish: (result: Metadata) => void;
};

export type ExtractionView = { job: Job; url: string; version: number };

// The hook owns one pending job and the hidden WebView that renders its current source.
export type ExtractionHost = {
  pending: { current: Job | null };
  nextVersion(): number;
  show(view: ExtractionView | null): void;
};

// Loads a supported product link in the hidden WebView and resolves with the best snapshot.
// The caller must have finished any previous job and checked the URL.
export function startExtraction(request: Request, host: ExtractionHost): Promise<Metadata> {
  const { pending } = host;
  const sourceURL = alternateProductExtractionURL(request.url) ?? request.url;
  let expectedProduct = canonicalProductExtractionURL(request.url);
  const { hostname: sourceHost } = new URL(request.url);
  const shortLinkShop = productShortLinkShop(request.url);
  const maxDuration = productExtractionMaxDuration(request.url);
  const shortLinkDestination = (url: string) => shortLinkRedirectProductURL(request.url, url);
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
      next.sourceVersion = host.nextVersion();
      host.show({ job: next, url, version: next.sourceVersion });
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
        isHttps(url) &&
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
      sourceVersion: host.nextVersion(),
      sourceURL,
      pageURL: sourceURL,
      script: productScanScript(request.shops, maxDuration),
      injectedAtURL: null,
      best: null,
      allowLateProductTime(url) {
        const now = Date.now();
        // A late Ably document can still hydrate its metadata. Do not reload it.
        if (
          expectedProduct?.startsWith('https://m.a-bly.com/goods/') &&
          now >= initialDeadline - 3_000 &&
          isHttps(url) &&
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
          new URL(url).hostname === sourceHost
        );
      },
      shouldInjectEarly(url, progress) {
        if (
          progress < 0.3 ||
          !url ||
          url === next.injectedAtURL ||
          !isHttps(url) ||
          !canonicalProductExtractionURL(url) ||
          !next.canLoad(url)
        )
          return false;
        next.injectedAtURL = url;
        return true;
      },
      allowNavigation(url, isTopFrame) {
        if (pending.current !== next) return false;
        if (
          isTopFrame &&
          sourceHost === 'musinsa.onelink.me' &&
          !webProductStarted &&
          !appFallback
        ) {
          const product = musinsaAppProductURL(url);
          // Keep OneLink's HTTPS navigation if it arrives. The app target is only a backup.
          if (product)
            appFallback = setTimeout(() => replaceSource(product), musinsaRedirectGraceMs);
        }
        if (!next.canLoad(url)) return false;
        if (!isTopFrame) return isHttps(url);
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
        const result = readProductMessage(data, origin, next.pageURL, request.shops, requested);
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
        host.show(null);
        resolve(result);
      },
    };
    let timer = setTimeout(() => next.finish(next.best), productExtractionTimeout);
    pending.current = next;
    host.show({ job: next, url: next.sourceURL, version: next.sourceVersion });
  });
}
