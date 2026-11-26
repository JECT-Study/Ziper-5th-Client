import { getExtractionRules } from '@ziper/api';
import { ApiError } from '@ziper/api/http';
import { productExtractionRules, type Shops } from '@ziper/product-extraction/schema';

const rulesKey = 'ziper.product-extraction-rules.v1';
// 서버는 5분이 지나면 다시 확인하도록 요구한다.
const maxRulesAge = 5 * 60 * 1_000;
const rulesTimeoutMs = 2_000;
type RulesCache = { etag: string | null; shops: Shops; confirmedAt: number };
let memoryCache: RulesCache | null = null;
let storageOutOfSync = false;

function loadRules(): RulesCache | null {
  if (storageOutOfSync) return memoryCache;
  try {
    const raw = localStorage.getItem(rulesKey);
    if (!raw || raw.length > 100_000) return null;
    const stored = JSON.parse(raw);
    const result = productExtractionRules.safeParse(stored);
    if (!result.success || !Number.isSafeInteger(stored.confirmedAt)) return null;
    return {
      shops: result.data.shops,
      confirmedAt: stored.confirmedAt,
      etag: typeof stored.etag === 'string' ? stored.etag : null,
    };
  } catch {
    return memoryCache;
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

function freshShops(entry = loadRules()) {
  const age = entry ? Date.now() - entry.confirmedAt : Infinity;
  return entry && age >= 0 && age < maxRulesAge ? entry.shops : [];
}

/** 규칙을 못 받아도 직접 입력은 막지 않으므로, 명시적인 취소 말고는 던지지 않고 [] 를 준다. */
export async function extractionRules(signal: AbortSignal): Promise<Shops> {
  const cache = loadRules();
  try {
    const response = await getExtractionRules({
      cache: 'no-store',
      headers: cache?.etag ? { 'If-None-Match': cache.etag } : undefined,
      signal: AbortSignal.any([signal, AbortSignal.timeout(rulesTimeoutMs)]),
    });
    if (response.status === 304) {
      // 다른 저장 화면이 그사이 규칙을 바꿨을 수 있다.
      const current = loadRules();
      if (!cache?.etag || current?.etag !== cache.etag) return freshShops(current);
      saveRules({ ...current, confirmedAt: Date.now() });
      return current.shops;
    }
    const parsed = productExtractionRules.safeParse(response.data);
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
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ApiError && error.status < 500 && error.status !== 429) {
      saveRules(null);
      return [];
    }
    return freshShops();
  }
}
