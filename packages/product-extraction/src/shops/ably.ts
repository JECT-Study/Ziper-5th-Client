import { secureProductURL } from '../url';
import type { Shop } from './shop';

// Match the deployed URL-check registry; the observed Ably redirect is only a navigation alias.
export const ablyProductRedirectHost = 'mobile.a-bly.com';
const canonicalBase = 'https://m.a-bly.com/goods/';

// Ably publishes this app-facing address as its first Open Graph URL.
export function ablyAppProductURL(url: URL) {
  if (!/^(?:www\.)?a-bly\.com\.?$/.test(url.hostname)) return null;
  // The storefront accepts encoded product digits, but not an encoded /app route.
  const id = /^\/app\/goods\/0*([1-9]\d*|0)\/?$/.exec(url.pathname.replace(/%3(\d)/g, '$1'))?.[1];
  return id ? canonicalBase + id : null;
}

export const ably: Shop = {
  id: 'ably',
  hosts: ['a-bly.com', 'www.a-bly.com', 'm.a-bly.com', ablyProductRedirectHost],
  // Ably renders padded paths but publishes the unpadded retailer ID and canonical URL.
  productPath: /^\/goods\/0*([1-9]\d*|0)(?:\/|$)/,
  canonicalBase,
  alternate: ablyAppProductURL,
  shortLink: {
    host: 'applink.a-bly.com',
    redirectProduct(_, value) {
      const url = secureProductURL(value);
      const id =
        url?.hostname === 'ably.airbridge.io' && /^\/goods\/(\d+)\/?$/.exec(url.pathname)?.[1];
      return id ? canonicalBase + id : null;
    },
  },
  // Ably's detail can hydrate several seconds after the document loads.
  maxDurationMs: 12_000,
  lateHydration: true,
};
