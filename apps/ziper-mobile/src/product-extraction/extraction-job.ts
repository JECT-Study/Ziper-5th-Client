import { Platform } from 'react-native';
import {
  alternateProductExtractionURL,
  canonicalProductExtractionURL,
  isAlternateProductURL,
  isHttps,
  isProductExtractionURL,
  productExtractionMaxDuration,
  productExtractionTimeout,
  productShop,
  shortLinkRedirectProductURL,
  shortLinkShop,
  type Shop,
} from '@ziper/product-extraction/link';
import { productDocumentURL, readProductMessage } from '@ziper/product-extraction/message';
import { productScanScript } from '@ziper/product-extraction/scanner';
import type { ProductMetadata, Shops } from '@ziper/product-extraction/schema';

type Request = { url: string; shops: Shops };
type Metadata = ProductMetadata | null;
export type LoadError = { url: string; code: number; domain?: string };

const appFallbackGraceMs = 2_000;
const minRetryTimeMs = 1_500;
const shortLinkProductWindowMs = 6_000;

function isTransientLoadError({ code, domain }: LoadError, platform: string) {
  // Both platforms expose distinct codes for timeouts, connection failures and I/O interruptions.
  return platform === 'ios'
    ? domain === 'NSURLErrorDomain' && [-1001, -1004, -1005].includes(code)
    : [-6, -7, -8].includes(code);
}

// Preserve one snapshot, not a mix of fields from different samples.
function addsOrChangesFields(sample: ProductMetadata, previous: Metadata | undefined) {
  return (
    !previous ||
    (sample.name !== '' && sample.name !== previous.name) ||
    (sample.price !== null && sample.price !== previous.price) ||
    (sample.imageURL !== null && sample.imageURL !== previous.imageURL)
  );
}

type Deferred = { data: string; origin: string; metadata: ProductMetadata };

/** Messages from a document whose navigation isn't reported yet, newest four documents. */
class DeferredMessages {
  private readonly byDocument = new Map<string, Deferred>();
  keep(documentURL: string, message: Deferred) {
    if (!addsOrChangesFields(message.metadata, this.byDocument.get(documentURL)?.metadata)) return;
    this.byDocument.delete(documentURL);
    this.byDocument.set(documentURL, message);
    const oldest = this.byDocument.keys().next().value;
    if (this.byDocument.size > 4 && oldest) this.byDocument.delete(oldest);
  }
  take(documentURL: string) {
    const message = this.byDocument.get(documentURL);
    this.byDocument.delete(documentURL);
    return message;
  }
  clear() {
    this.byDocument.clear();
  }
}

export type ExtractionView = { job: ExtractionJob; url: string; version: number };

/** The hook that renders the hidden WebView for the job's current source. */
export type ExtractionHost = {
  nextVersion(): number;
  show(view: ExtractionView | null): void;
};

/**
 * Loads one supported product link in the hidden WebView and resolves with the best snapshot.
 * WebView events are forwarded here only while `isCurrent(version)` holds for their view.
 */
export class ExtractionJob {
  readonly script: string;
  sourceURL: string;
  pageURL: string;
  sourceVersion = 0;
  private injectedAtURL: string | null = null;
  private best: Metadata = null;
  private done = false;
  private expectedProduct: string | null;
  private readonly shortLink: Shop | undefined;
  private readonly sourceHost: string;
  private readonly maxDuration: number;
  private readonly startedAt = Date.now();
  private readonly initialDeadline = this.startedAt + productExtractionTimeout;
  private deadline = this.initialDeadline;
  // Late hydration can extend the wait for data, not the window for another request.
  private retryDeadline = this.initialDeadline;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private appFallback: ReturnType<typeof setTimeout> | undefined;
  private webProductStarted = false;
  private retriedLoad = false;
  private readonly deferred = new DeferredMessages();
  private resolve: (result: Metadata) => void = () => {};

  constructor(
    private readonly request: Request,
    private readonly host: ExtractionHost,
    private readonly platform: string = Platform.OS,
  ) {
    this.sourceURL = alternateProductExtractionURL(request.url) ?? request.url;
    this.pageURL = this.sourceURL;
    this.expectedProduct = canonicalProductExtractionURL(request.url);
    this.shortLink = shortLinkShop(request.url);
    this.sourceHost = new URL(request.url).hostname;
    this.maxDuration = productExtractionMaxDuration(request.url);
    this.script = productScanScript(request.shops, this.maxDuration);
  }

  /** The caller must have finished any previous job and checked the URL. */
  start(): Promise<Metadata> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.sourceVersion = this.host.nextVersion();
      this.timer = setTimeout(() => this.finish(this.best), productExtractionTimeout);
      this.host.show({ job: this, url: this.sourceURL, version: this.sourceVersion });
    });
  }

  isCurrent(version: number) {
    return !this.done && version === this.sourceVersion;
  }

  finish(result: Metadata) {
    if (this.done) return;
    this.done = true;
    clearTimeout(this.timer);
    clearTimeout(this.appFallback);
    this.host.show(null);
    this.resolve(result);
  }

  canLoad(url: string) {
    const product =
      shortLinkRedirectProductURL(this.request.url, url) ?? canonicalProductExtractionURL(url);
    if (product) {
      return this.expectedProduct
        ? product === this.expectedProduct
        : productShop(product) === this.shortLink;
    }
    return (
      !this.expectedProduct &&
      isProductExtractionURL(url, true) &&
      new URL(url).hostname === this.sourceHost
    );
  }

  allowNavigation(url: string, isTopFrame: boolean) {
    if (this.done) return false;
    const appFallback = this.shortLink?.shortLink?.appFallback;
    if (isTopFrame && appFallback && !this.webProductStarted && !this.appFallback) {
      const product = appFallback(url);
      // Keep the shop's HTTPS navigation if it arrives. The app target is only a backup.
      if (product)
        this.appFallback = setTimeout(() => this.replaceSource(product), appFallbackGraceMs);
    }
    if (!this.canLoad(url)) return false;
    if (!isTopFrame) return isHttps(url);
    this.markWebProduct(url);
    return !this.replaceAlternate(url);
  }

  /** Returns whether the scanner should be injected again into the new document. */
  loadStarted(version: number, url: string) {
    // Progress can inject into the previous document; the scan is idempotent here.
    const earlyInjection = this.pageURL !== url && this.injectedAtURL === url;
    this.updatePage(url);
    // Android emits this from doUpdateVisitedHistory, before a slow page finishes loading.
    if (this.platform === 'android' && this.isCurrent(version)) this.allowLateProductTime(url);
    return earlyInjection && this.isCurrent(version);
  }

  // Some Android redirects only report the final URL at load finish.
  loaded(version: number, url: string) {
    this.updatePage(url);
    if (this.isCurrent(version)) this.allowLateProductTime(url);
  }

  // The product may already be readable while Android still reports the short link.
  // Injection does not confirm navigation; readMessage still waits for updatePage.
  shouldInjectEarly(url: string, progress: number) {
    if (
      progress < 0.3 ||
      !url ||
      url === this.injectedAtURL ||
      !isHttps(url) ||
      !canonicalProductExtractionURL(url) ||
      !this.canLoad(url)
    )
      return false;
    this.injectedAtURL = url;
    return true;
  }

  readMessage(data: string, origin: string) {
    if (this.done) return;
    const { shops } = this.request;
    const requestedURL = this.expectedProduct ?? this.sourceURL;
    const result = readProductMessage(data, { origin, pageURL: this.pageURL, shops, requestedURL });
    if (!result) {
      const candidate = readProductMessage(data, { origin, pageURL: null, shops, requestedURL });
      if (candidate && this.canLoad(candidate.documentURL))
        this.deferred.keep(candidate.documentURL, { data, origin, metadata: candidate.metadata });
      return;
    }
    // A previously committed document can still report a partial snapshot during redirect.
    const { metadata, complete } = result;
    if (complete) return this.finish(metadata);
    if (addsOrChangesFields(metadata, this.best)) this.best = metadata;
  }

  loadFailed(error: LoadError) {
    // WKWebView can report no current URL if the top-level load failed before commit.
    const url = error.url || (this.platform === 'ios' ? this.pageURL : '');
    if (url === this.pageURL && isTransientLoadError(error, this.platform)) this.retryProductPage();
    else this.finish(null);
  }

  httpFailed(url: string, status: number) {
    // Gateway failures can be transient; never retry denial or rate limiting.
    if (url && (status === 502 || status === 504)) this.retryProductPage(url);
    else this.finish(null);
  }

  rendererGone() {
    this.retryProductPage();
  }

  private updatePage(url: string) {
    if (this.done || url === 'about:blank') return;
    if (!this.canLoad(url)) return this.finish(null);
    this.markWebProduct(url);
    if (this.replaceAlternate(url)) return;
    // Once a short link commits to a product, don't switch to another product on the same shop.
    this.confirmProduct(url);
    if (url === this.pageURL) return;
    const key = productDocumentURL(url).href;
    const sameDocument = key === productDocumentURL(this.pageURL).href;
    this.pageURL = url;
    if (sameDocument) return;
    // A query change can select another option of the same product.
    this.best = null;
    const deferred = this.deferred.take(key);
    if (deferred) this.readMessage(deferred.data, deferred.origin);
  }

  /** The web page of the expected product itself, not a short link or app address. */
  private isExpectedProductPage(url: string) {
    return (
      isHttps(url) &&
      canonicalProductExtractionURL(url) === this.expectedProduct &&
      !isAlternateProductURL(url)
    );
  }

  private allowLateProductTime(url: string) {
    const now = Date.now();
    // A late document can still hydrate its metadata. Do not reload it.
    if (
      this.expectedProduct &&
      productShop(this.expectedProduct)?.lateHydration &&
      now >= this.initialDeadline - 3_000 &&
      this.isExpectedProductPage(url)
    )
      this.extendDeadline(this.startedAt + this.maxDuration, now);
  }

  private extendDeadline(limit: number, now: number) {
    if (now >= this.deadline || limit <= this.deadline) return;
    this.deadline = limit;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.finish(this.best), this.deadline - now);
  }

  private confirmProduct(url: string) {
    if (this.expectedProduct) return;
    this.expectedProduct = canonicalProductExtractionURL(url);
    if (!this.expectedProduct || !this.shortLink) return;
    const now = Date.now();
    this.extendDeadline(
      Math.min(this.startedAt + this.maxDuration, now + shortLinkProductWindowMs),
      now,
    );
    this.retryDeadline = this.deadline;
  }

  private markWebProduct(url: string) {
    if (!canonicalProductExtractionURL(url)) return;
    this.webProductStarted = true;
    clearTimeout(this.appFallback);
  }

  private replaceSource(url: string, retry = false) {
    if (this.done || (!retry && this.sourceURL === url)) return;
    this.markWebProduct(url);
    this.confirmProduct(url);
    this.sourceURL = url;
    this.pageURL = url;
    this.injectedAtURL = null;
    this.best = null;
    this.deferred.clear();
    this.sourceVersion = this.host.nextVersion();
    this.host.show({ job: this, url, version: this.sourceVersion });
  }

  private replaceAlternate(url: string) {
    const alternate =
      shortLinkRedirectProductURL(this.request.url, url) ?? alternateProductExtractionURL(url);
    if (!alternate) return false;
    this.replaceSource(alternate);
    return true;
  }

  private retryProductPage(url = this.pageURL) {
    // Never reopen a short link or an unconfirmed destination after a failure.
    if (
      !this.retriedLoad &&
      this.expectedProduct &&
      this.isExpectedProductPage(url) &&
      !alternateProductExtractionURL(url) &&
      this.retryDeadline - Date.now() >= minRetryTimeMs
    ) {
      this.retriedLoad = true;
      this.replaceSource(url, true);
    } else this.finish(null);
  }
}
