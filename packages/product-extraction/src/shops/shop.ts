import { normalizedLocation } from '../url';

/**
 * Everything Ziper knows about one shop's links. Generic link handling and the extraction job
 * consult these instead of naming shops.
 */
export interface Shop {
  readonly id: 'musinsa' | 'ably' | 'zigzag';
  /** Hosts of the web product page, matching the server's URL-check registry. */
  readonly hosts: readonly string[];
  /** Captures the product ID from a normalized path. */
  readonly productPath: RegExp;
  readonly canonicalBase: string;
  /** An app-only or affiliate address that names a product but isn't its web page. */
  alternate?(url: URL): string | null;
  readonly shortLink?: {
    readonly host: string;
    /** An intermediate redirect that already names the product it will open. */
    redirectProduct?(shortLink: URL, url: string): string | null;
    /** An app-scheme target to load if the HTTPS redirect doesn't arrive. */
    appFallback?(url: string): string | null;
  };
  /** Extraction wait for a direct product link. */
  readonly maxDurationMs: number;
  /** A late document can still hydrate its metadata, so extend the wait instead of reloading. */
  readonly lateHydration?: boolean;
}

export const defaultMaxDurationMs = 8_000;

export function shopProductURL(shop: Shop, url: URL) {
  const { host, path } = normalizedLocation(url);
  if (!shop.hosts.includes(host)) return null;
  const id = shop.productPath.exec(path)?.[1];
  return id ? shop.canonicalBase + id : null;
}
