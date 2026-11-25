import { canonicalProductExtractionURL } from '@ziper/bridge/contract';

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
    const product =
      link && !extra.length && /^https:\/\//i.test(link)
        ? canonicalProductExtractionURL(link)
        : null;
    return product?.startsWith('https://www.musinsa.com/products/') ? product : null;
  } catch {
    return null;
  }
}
