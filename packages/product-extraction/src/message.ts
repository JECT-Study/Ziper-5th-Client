import { ablyAppProductURL, ablyProductRedirectHost, canonicalProductExtractionURL } from './link';
import { productMetadata, type ProductMetadata, type Shops } from './schema';

export function productDocumentURL(value: string) {
  const url = new URL(value);
  url.hash = '';
  return url;
}

export function readProductMessage(
  data: string,
  sourceURL: string,
  pageURL: string | null,
  shops: Shops,
  requestedURL = pageURL,
): { documentURL: string; metadata: ProductMetadata; complete: boolean } | null {
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
      ablyAppProductURL(page) ||
      source.origin !== page.origin ||
      (source.href !== `${source.origin}/` && source.href !== page.href)
    )
      return null;
    if (payload.href !== page.href) return null;
    const host = page.hostname === ablyProductRedirectHost ? 'm.a-bly.com' : page.hostname;
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
