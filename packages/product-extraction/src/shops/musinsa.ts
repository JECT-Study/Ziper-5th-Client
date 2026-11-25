import { standardPortURL } from '../url';
import { defaultMaxDurationMs, shopProductURL, type Shop } from './shop';

export const musinsa: Shop = {
  id: 'musinsa',
  hosts: ['musinsa.com', 'www.musinsa.com', 'm.musinsa.com', 'store.musinsa.com'],
  productPath: /^\/(?:products|app\/goods)\/(\d+)(?:\/|$)/,
  canonicalBase: 'https://www.musinsa.com/products/',
  shortLink: { host: 'musinsa.onelink.me', appFallback: musinsaAppProductURL },
  maxDurationMs: defaultMaxDurationMs,
};

// Musinsa OneLink can hand the WebView an app-only target before its HTTPS fallback.
export function musinsaAppProductURL(value: string): string | null {
  if (value.length > 4096) return null;
  try {
    const app = new URL(value);
    if (
      app.protocol !== 'musinsaad:' ||
      app.host !== 'web' ||
      app.username ||
      app.password ||
      (app.pathname && app.pathname !== '/')
    )
      return null;
    const [link, ...extra] = app.searchParams.getAll('link');
    const url = link && !extra.length && /^https:\/\//i.test(link) ? standardPortURL(link) : null;
    return url ? shopProductURL(musinsa, url) : null;
  } catch {
    return null;
  }
}
