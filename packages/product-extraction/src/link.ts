// Shop-agnostic link handling shared by the web form, the bridge contract and the app
// extraction WebView. Shop specifics live in ./shops.
import { ably, ablyProductRedirectHost, shopProductURL, shops, type Shop } from './shops';
import { isShareURL, secureProductURL, standardPortURL } from './url';

export { ablyAppProductURL, ablyProductRedirectHost, musinsaAppProductURL } from './shops';
export { isHttps, isShareURL, secureProductURL } from './url';
export type { Shop } from './shops';

export const shopHosts = Object.fromEntries(shops.map((shop) => [shop.id, shop.hosts])) as Record<
  Shop['id'],
  readonly string[]
>;

/** The rule host for a page; the Ably redirect alias shares the canonical host's rules. */
export function ruleHost(hostname: string) {
  return hostname === ablyProductRedirectHost ? 'm.a-bly.com' : hostname;
}

/** The shop whose short-link host this is. */
export function shortLinkShop(value: string): Shop | undefined {
  const url = secureProductURL(value);
  return url ? shops.find((shop) => shop.shortLink?.host === url.hostname) : undefined;
}

/** The shop that owns a canonical product URL. */
export function productShop(canonicalURL: string): Shop | undefined {
  return shops.find((shop) => canonicalURL.startsWith(shop.canonicalBase));
}

function alternateProduct(url: URL) {
  for (const shop of shops) {
    const product = shop.alternate?.(url);
    if (product) return product;
  }
  return null;
}

function directProduct(url: URL) {
  for (const shop of shops) {
    const product = shopProductURL(shop, url);
    if (product) return product;
  }
  return null;
}

/** Whether a URL names a product but is not the web page to read it from. */
export function isAlternateProductURL(value: string) {
  const url = standardPortURL(value);
  return Boolean(url && alternateProduct(url));
}

/** The HTTPS page to load instead of a legacy or app-only product address, if any. */
export function alternateProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  if (!url) return null;
  // Let Ably redirect offer-bearing app links. Dropping the query changes the price;
  // copying it ourselves would send arbitrary parameters across hosts.
  if (url.search && ably.alternate!(url)) {
    // WKWebView can fail TLS on the trailing-dot spelling of the same DNS name.
    if (url.protocol === 'https:' && !url.hostname.endsWith('.')) return null;
    return `https://${url.hostname.replace(/\.$/, '')}${url.pathname}${url.search}${url.hash}`;
  }
  // Recognize legacy addresses without ever navigating to a non-HTTPS product page.
  if (url.protocol === 'http:' || url.hostname.endsWith('.') || url.pathname.includes('%')) {
    const direct = directProduct(url);
    if (direct && url.search) {
      const host = url.hostname.replace(/\.+$/, '');
      const pdp = new URL(direct);
      // Ably also serves /goods/{id} via redirects. Upgrade and decode the path
      // on the submitted host so the shop handles its offer query.
      if (host === pdp.hostname || productShop(direct) === ably)
        return `https://${host}${pdp.pathname}${url.search}`;
    }
    return direct ?? alternateProduct(url);
  }
  return alternateProduct(url);
}

/** A short link's intermediate redirect that already names the product it will open. */
export function shortLinkRedirectProductURL(shortLink: string, url: string) {
  const link = new URL(shortLink);
  const shop = shortLinkShop(shortLink);
  return shop?.shortLink?.redirectProduct?.(link, url) ?? null;
}

export function canonicalProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  return url ? (directProduct(url) ?? alternateProduct(url)) : null;
}

// Only known product pages or short-link hosts may load in the extraction WebView.
export function isProductExtractionURL(value: string, allowShortLinks = false): boolean {
  return Boolean(canonicalProductExtractionURL(value) || (allowShortLinks && shortLinkShop(value)));
}

export function findSharedURL(text: string): string | null {
  if (text.length > 16384) return null;
  const plain = text.trim();
  const trimPunctuation = (url: string) => url.replace(/[)\]}>.,!?。！？，]+$/u, '');
  if (isShareURL(plain)) {
    // A bare paste can contain a trailing sentence mark. Preserve valid product queries and opaque short links.
    if (canonicalProductExtractionURL(plain)) return plain;
    const candidate = trimPunctuation(plain);
    return candidate !== plain && canonicalProductExtractionURL(candidate) ? candidate : plain;
  }

  let firstURL: string | null = null;
  let firstShortLink: string | null = null;
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const links = /“(https?:\/\/[^\s”<>]+)”|‘(https?:\/\/[^\s’<>]+)’|https?:\/\/[^\s<>"'`]+/giu;
  for (const match of text.matchAll(links)) {
    const [token, doubleQuoted, singleQuoted] = match;
    const before = text[match.index - 1];
    const after = text[match.index + token.length];
    const enclosed =
      (before === '<' && after === '>') ||
      ((before === '"' || before === "'" || before === '`') && before === after);
    // Inside paired delimiters the boundary is known: punctuation may select a different offer.
    const close = before && brackets[before];
    const bracketed = close ? token.replace(/[.,!?。！？，]+$/u, '') : '';
    const bounded =
      doubleQuoted ??
      singleQuoted ??
      (close && bracketed.endsWith(close) ? bracketed.slice(0, -1) : undefined);
    const keepToken = enclosed || (/[?#]/.test(token) && canonicalProductExtractionURL(token));
    const url = bounded ?? (keepToken ? token : trimPunctuation(token));
    if (!isShareURL(url)) continue;
    if (canonicalProductExtractionURL(url)) return url;
    if (shortLinkShop(url)) firstShortLink ??= url;
    firstURL ??= url;
  }
  return firstShortLink ?? firstURL;
}

export const productExtractionTimeout = 8_000;
export const shortProductExtractionTimeout = 12_000;

export function productExtractionMaxDuration(url: string) {
  if (shortLinkShop(url)) return shortProductExtractionTimeout;
  const product = canonicalProductExtractionURL(url);
  return (product && productShop(product)?.maxDurationMs) || productExtractionTimeout;
}
