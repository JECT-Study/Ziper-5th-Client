// Shop link rules shared by the web form, the bridge contract and the app extraction WebView.

export function isShareURL(value: string): boolean {
  if (value.length > 4096 || /[\s\\]/u.test(value)) return false;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    return false;
  const scheme = /^https?:\/\//i.exec(value)?.[0];
  if (!scheme) return false;
  // Check userinfo in the authority only; the React Native URL implementation can match @ in the path.
  const authority = value.slice(scheme.length).split(/[/?#]/, 1)[0];
  if (!authority || authority.includes('@')) return false;
  try {
    return Boolean(new URL(scheme.toLowerCase() + value.slice(scheme.length)).hostname);
  } catch {
    return false;
  }
}

// Match the deployed URL-check registry; the observed Ably redirect is only a navigation alias.
export const ablyProductRedirectHost = 'mobile.a-bly.com';
export const shopHosts = {
  musinsa: ['musinsa.com', 'www.musinsa.com', 'm.musinsa.com', 'store.musinsa.com'],
  ably: ['a-bly.com', 'www.a-bly.com', 'm.a-bly.com', ablyProductRedirectHost],
  zigzag: ['zigzag.kr', 'www.zigzag.kr', 's.zigzag.kr', 'store.zigzag.kr'],
};
const zigzagProductBase = 'https://zigzag.kr/catalog/products/';
const zigzagHosts = shopHosts.zigzag;
const productRoutes = [
  {
    hosts: shopHosts.musinsa,
    path: /^\/(?:products|app\/goods)\/(\d+)(?:\/|$)/,
    canonical: 'https://www.musinsa.com/products/',
  },
  {
    hosts: shopHosts.ably,
    // Ably renders padded paths but publishes the unpadded retailer ID and canonical URL.
    path: /^\/goods\/0*([1-9]\d*|0)(?:\/|$)/,
    canonical: 'https://m.a-bly.com/goods/',
  },
  {
    hosts: zigzagHosts,
    path: /^\/catalog\/products\/(\d+)(?:\/|$)/,
    canonical: zigzagProductBase,
  },
];
const shortLinkShops = new Map([
  ['musinsa.onelink.me', 'www.musinsa.com'],
  ['applink.a-bly.com', 'm.a-bly.com'],
  ['s.zigzag.kr', 'zigzag.kr'],
]);

export function productShortLinkShop(value: string) {
  const url = secureProductURL(value);
  return url ? shortLinkShops.get(url.hostname) : undefined;
}

function standardPortURL(value: string) {
  if (!isShareURL(value)) return null;
  const url = new URL(value);
  return url.port ? null : url;
}

export function secureProductURL(value: string) {
  const url = standardPortURL(value);
  return url?.protocol === 'https:' ? url : null;
}

// The affiliate landing page and the app-only URL identify a product but are not its web PDP.
function zigzagAlternateProduct(url: URL | null) {
  if (!url || !zigzagHosts.includes(url.hostname)) return null;
  const ids =
    url.pathname === '/bridges/creator-lounge/pdp'
      ? url.searchParams.getAll('product_id')
      : [/^\/app\/catalog\/products\/(\d+)\/?$/.exec(url.pathname)?.[1]];
  const id = ids[0];
  return ids.length === 1 && id && /^\d+$/.test(id) ? zigzagProductBase + id : null;
}

// Ably publishes this app-facing address as its first Open Graph URL.
export function ablyAppProductURL(url: URL) {
  if (!/^(?:www\.)?a-bly\.com\.?$/.test(url.hostname)) return null;
  // The storefront accepts encoded product digits, but not an encoded /app route.
  const id = /^\/app\/goods\/0*([1-9]\d*|0)\/?$/.exec(url.pathname.replace(/%3(\d)/g, '$1'))?.[1];
  return id ? `https://m.a-bly.com/goods/${id}` : null;
}

function alternateProduct(url: URL) {
  return ablyAppProductURL(url) ?? zigzagAlternateProduct(url);
}

function directProduct(url: URL) {
  const host = url.hostname.replace(/\.+$/, '');
  const path = url.pathname.replace(/%([\da-f]{2})/gi, (encoded, hex: string) => {
    const char = String.fromCharCode(Number.parseInt(hex, 16));
    return /^[\w.~-]$/.test(char) ? char : encoded;
  });
  const route = productRoutes.find(({ hosts }) => hosts.includes(host));
  const id = route?.path.exec(path)?.[1];
  return route && id ? route.canonical + id : null;
}

export function alternateProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  if (!url) return null;
  // Let Ably redirect offer-bearing app links. Dropping the query changes the price;
  // copying it ourselves would send arbitrary parameters across hosts.
  if (url.search && ablyAppProductURL(url)) {
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
      if (host === pdp.hostname || pdp.hostname === 'm.a-bly.com')
        return `https://${host}${pdp.pathname}${url.search}`;
    }
    return direct ?? alternateProduct(url);
  }
  return alternateProduct(url);
}

function ablyAirbridgeProductURL(value: string) {
  const url = secureProductURL(value);
  const id = url?.hostname === 'ably.airbridge.io' && /^\/goods\/(\d+)\/?$/.exec(url.pathname)?.[1];
  return id ? `https://m.a-bly.com/goods/${id}` : null;
}

function zigzagAffiliateProductURL(value: string) {
  const url = secureProductURL(value);
  if (url?.hostname !== 'abr.ge' || url.pathname !== '/@zigzag/affiliate') return null;
  const links = url.searchParams.getAll('deeplink_url');
  if (links.length !== 1) return null;
  try {
    const link = new URL(links[0]!);
    if (
      link.protocol !== 'zigzag:' ||
      link.host !== 'open' ||
      link.username ||
      link.password ||
      link.pathname !== '/full_screen_simple_browser'
    )
      return null;
    const targets = link.searchParams.getAll('url');
    const ids = link.searchParams.getAll('product_id');
    const target = targets.length === 1 ? secureProductURL(targets[0]!) : null;
    const product =
      target?.pathname === '/bridges/creator-lounge/pdp' ? zigzagAlternateProduct(target) : null;
    return ids.length === 1 && product === zigzagProductBase + ids[0] ? product : null;
  } catch {
    return null;
  }
}

// A short link's intermediate redirect that already names the product it will open.
export function shortLinkRedirectProductURL(shortLink: string, url: string) {
  const { hostname, pathname } = new URL(shortLink);
  if (hostname === 'applink.a-bly.com') return ablyAirbridgeProductURL(url);
  return hostname === 's.zigzag.kr' && pathname.startsWith('/abr/')
    ? zigzagAffiliateProductURL(url)
    : null;
}

export function canonicalProductExtractionURL(value: string) {
  const url = standardPortURL(value);
  return url ? (directProduct(url) ?? alternateProduct(url)) : null;
}

// Only known product pages or short-link hosts may load in the extraction WebView.
export function isProductExtractionURL(value: string, allowShortLinks = false): boolean {
  return Boolean(
    canonicalProductExtractionURL(value) || (allowShortLinks && productShortLinkShop(value)),
  );
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
    if (productShortLinkShop(url)) firstShortLink ??= url;
    firstURL ??= url;
  }
  return firstShortLink ?? firstURL;
}

export const productExtractionTimeout = 8_000;
export const shortProductExtractionTimeout = 12_000;

export function productExtractionMaxDuration(url: string) {
  if (productShortLinkShop(url)) return shortProductExtractionTimeout;
  return canonicalProductExtractionURL(url)?.startsWith('https://m.a-bly.com/goods/')
    ? 12_000
    : productExtractionTimeout;
}

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
    const product =
      link && !extra.length && /^https:\/\//i.test(link)
        ? canonicalProductExtractionURL(link)
        : null;
    return product?.startsWith('https://www.musinsa.com/products/') ? product : null;
  } catch {
    return null;
  }
}
