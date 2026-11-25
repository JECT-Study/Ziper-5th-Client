import type { ProductSaveApi } from '@ziper/api/product-save';
import {
  canonicalProductExtractionURL,
  isProductExtractionURL,
  productExtractionRules,
  type Input,
  type Output,
} from '@ziper/bridge/contract';
import { requestResponse } from '../../shared/api/http';
import { productSaveApi } from './product-save-api';

type Shops = Input<'extractProductV1'>['shops'];
type Extract = (
  input: Input<'extractProductV1'>,
  signal: AbortSignal,
) => Promise<Output<'extractProductV1'>>;
const rulesKey = 'ziper.product-extraction-rules.v1';
// The server requires revalidation after its five-minute freshness window.
const maxRulesAge = 5 * 60 * 1_000;
const rulesNetworkBudgetMs = 2_000;
type RulesCache = { etag: string | null; shops: Shops; confirmedAt: number };
let memoryCache: RulesCache | null = null;
let storageOutOfSync = false;

function loadRules(): RulesCache | null {
  // Reads may still succeed after a failed write or invalidation, but return the old entry.
  if (storageOutOfSync) return memoryCache;
  let raw: string | null;
  try {
    raw = localStorage.getItem(rulesKey);
  } catch {
    return memoryCache;
  }
  if (!raw || raw.length > 100_000) return null;
  try {
    const stored = JSON.parse(raw);
    const result = productExtractionRules.safeParse(stored);
    if (!result.success || !Number.isSafeInteger(stored.confirmedAt)) return null;
    return {
      ...result.data,
      confirmedAt: stored.confirmedAt,
      etag: typeof stored.etag === 'string' ? stored.etag : null,
    };
  } catch {
    return null;
  }
}

function saveRules(entry: RulesCache | null) {
  memoryCache = entry;
  try {
    if (entry) localStorage.setItem(rulesKey, JSON.stringify(entry));
    else localStorage.removeItem(rulesKey);
    storageOutOfSync = false;
  } catch {
    storageOutOfSync = true;
  }
}

async function rules(signal: AbortSignal): Promise<Shops> {
  const cache = loadRules();
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  const deadline = performance.now() + rulesNetworkBudgetMs;
  let timer = setTimeout(() => controller.abort(), rulesNetworkBudgetMs);
  let pausedForRefresh = false;
  // Another save screen can confirm, replace or invalidate rules while this GET is pending.
  const cachedIfFresh = (entry = loadRules()) => {
    const age = entry ? Date.now() - entry.confirmedAt : Infinity;
    return entry && age >= 0 && age < maxRulesAge ? entry.shops : [];
  };
  try {
    const fetchRules = () =>
      requestResponse('/api/v1/products/extraction-rules', {
        auth: true,
        cache: 'no-store',
        onRefreshWait() {
          // Fresh rules can already serve this lookup. Only a cold start needs the auth wait.
          if (pausedForRefresh || cachedIfFresh().length) return;
          const remaining = deadline - performance.now();
          if (remaining <= 0) return;
          pausedForRefresh = true;
          clearTimeout(timer);
          return () => {
            timer = setTimeout(() => controller.abort(), remaining);
          };
        },
        headers: cache?.etag ? { 'If-None-Match': cache.etag } : undefined,
        signal: controller.signal,
      });
    for (let attempt = 0; ; attempt++) {
      controller.signal.throwIfAborted();
      const canRetry = (response?: Response) =>
        attempt === 0 &&
        !controller.signal.aborted &&
        !response?.headers.has('Retry-After') &&
        !cachedIfFresh(cache).length &&
        !cachedIfFresh().length;
      let response: Response;
      try {
        response = await fetchRules();
      } catch (error) {
        // The first-party GET can lose the connection before any response headers arrive.
        if (error instanceof TypeError && canRetry()) continue;
        throw error;
      }
      controller.signal.throwIfAborted();
      // Production CORS does not expose Retry-After, so only retry a 503 if we can check it.
      if (
        (response.status === 502 ||
          response.status === 504 ||
          (response.status === 503 && response.type !== 'cors')) &&
        canRetry(response)
      )
        continue;
      if (response.status === 304 && cache?.etag) {
        const current = loadRules();
        if (current?.etag !== cache.etag) return cachedIfFresh(current);
        saveRules({ ...current, confirmedAt: Date.now() });
        return current.shops;
      }
      if (response.status >= 500 || response.status === 429) return cachedIfFresh();
      if (!response.ok) {
        saveRules(null);
        return [];
      }
      // An interrupted body consumes the same retry as a gateway error, not a new deadline.
      let body: string;
      try {
        body = await response.text();
      } catch (error) {
        if (response.status === 200 && canRetry(response)) continue;
        throw error;
      }
      controller.signal.throwIfAborted();
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        data = null;
      }
      const parsed = productExtractionRules.safeParse(data);
      if (!parsed.success) {
        saveRules(null);
        return [];
      }
      saveRules({
        etag: response.headers.get('etag'),
        shops: parsed.data.shops,
        confirmedAt: Date.now(),
      });
      return parsed.data.shops;
    }
  } catch (error) {
    signal.throwIfAborted();
    // A stalled shared rotation needs a user retry, not a URL check that rotates the cookie again.
    if (
      pausedForRefresh &&
      !controller.signal.aborted &&
      error instanceof DOMException &&
      error.name === 'AbortError'
    )
      throw error;
    // An unavailable rules service must not prevent manual saving.
    return cachedIfFresh();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export function productSaveWithExtraction(extract: Extract): ProductSaveApi {
  return {
    ...productSaveApi,
    async lookup(url, signal) {
      if (!isProductExtractionURL(url, true)) return productSaveApi.lookup(url, signal);
      const shops = await rules(signal);
      signal.throwIfAborted();
      const metadata = shops.length
        ? await extract({ url, shops }, signal).catch(() => null)
        : null;
      signal.throwIfAborted();
      const lookup = await productSaveApi.lookup(
        metadata?.url ?? canonicalProductExtractionURL(url) ?? url,
        signal,
      );
      const extractedURL = metadata && canonicalProductExtractionURL(metadata.url);
      if (
        lookup.status !== 'ready' ||
        !metadata ||
        !extractedURL ||
        canonicalProductExtractionURL(lookup.url) !== extractedURL
      )
        return lookup;
      const { name, price, imageURL } = metadata;
      return name || price !== null || imageURL
        ? { ...lookup, product: { name, price, imageURL } }
        : lookup;
    },
  };
}
