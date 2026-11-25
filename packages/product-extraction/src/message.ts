import { canonicalProductExtractionURL, isAlternateProductURL, ruleHost } from './link';
import { productMetadata, type ProductMetadata, type Shops } from './schema';

export function productDocumentURL(value: string) {
  const url = new URL(value);
  url.hash = '';
  return url;
}

export type ProductMessageContext = {
  /** The message origin: Android reports the origin, iOS the frame URL. */
  origin: string;
  /** The committed page URL, or null to validate a candidate before navigation is reported. */
  pageURL: string | null;
  shops: Shops;
  /** The product the job expects. Defaults to the page itself. */
  requestedURL?: string | null;
};

export type ProductMessage = { documentURL: string; metadata: ProductMetadata; complete: boolean };

/** Validates a scanner message against the page and the requested product. */
export function readProductMessage(
  data: string,
  { origin: sourceURL, pageURL, shops, requestedURL = pageURL }: ProductMessageContext,
): ProductMessage | null {
  if (data.length > 8_000) return null;
  try {
    const parsed = productMetadata.safeParse(JSON.parse(data));
    if (!parsed.success) return null;
    // Before a navigation event this only validates a candidate for buffering, not for use.
    const productURL = canonicalProductExtractionURL(pageURL ?? parsed.data.url);
    const requestedProduct = requestedURL && canonicalProductExtractionURL(requestedURL);
    if (!productURL || (requestedProduct && requestedProduct !== productURL)) return null;
    const source = productDocumentURL(sourceURL);
    const payload = productDocumentURL(parsed.data.url);
    const page = pageURL === null ? payload : productDocumentURL(pageURL);
    // Android reports the origin; iOS reports the frame URL, which may omit the fragment.
    if (
      page.protocol !== 'https:' ||
      isAlternateProductURL(page.href) ||
      source.origin !== page.origin ||
      (source.href !== `${source.origin}/` && source.href !== page.href)
    )
      return null;
    if (payload.href !== page.href) return null;
    const host = ruleHost(page.hostname);
    const shop = shops.find(({ hosts }) => hosts.includes(host));
    if (!shop) return null;
    const clientUpload = shop.imageStrategy === 'CLIENT_UPLOAD';
    const { imageURL } = parsed.data;
    const image = imageURL && !clientUpload ? new URL(imageURL) : null;
    const allowed = image && !image.port && shop.imageHosts.includes(image.hostname);
    const metadata = { ...parsed.data, url: productURL, imageURL: allowed ? imageURL : null };
    return {
      documentURL: payload.href,
      metadata,
      complete: Boolean(
        metadata.name && metadata.price !== null && (metadata.imageURL || clientUpload),
      ),
    };
  } catch {
    return null;
  }
}
