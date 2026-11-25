import { secureProductURL } from '../url';
import { defaultMaxDurationMs, type Shop } from './shop';

const canonicalBase = 'https://zigzag.kr/catalog/products/';
const hosts = ['zigzag.kr', 'www.zigzag.kr', 's.zigzag.kr', 'store.zigzag.kr'];

// The affiliate landing page and the app-only URL identify a product but are not its web PDP.
function zigzagAlternateProduct(url: URL | null) {
  if (!url || !hosts.includes(url.hostname)) return null;
  const ids =
    url.pathname === '/bridges/creator-lounge/pdp'
      ? url.searchParams.getAll('product_id')
      : [/^\/app\/catalog\/products\/(\d+)\/?$/.exec(url.pathname)?.[1]];
  const id = ids[0];
  return ids.length === 1 && id && /^\d+$/.test(id) ? canonicalBase + id : null;
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
    return ids.length === 1 && product === canonicalBase + ids[0] ? product : null;
  } catch {
    return null;
  }
}

export const zigzag: Shop = {
  id: 'zigzag',
  hosts,
  productPath: /^\/catalog\/products\/(\d+)(?:\/|$)/,
  canonicalBase,
  alternate: zigzagAlternateProduct,
  shortLink: {
    host: 's.zigzag.kr',
    redirectProduct: (shortLink, url) =>
      shortLink.pathname.startsWith('/abr/') ? zigzagAffiliateProductURL(url) : null,
  },
  maxDurationMs: defaultMaxDurationMs,
};
