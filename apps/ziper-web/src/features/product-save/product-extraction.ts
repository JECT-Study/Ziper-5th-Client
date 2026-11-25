import type { ProductSaveApi } from '@ziper/api/product-save';
import type { Input, Output } from '@ziper/bridge/contract';
import {
  canonicalProductExtractionURL,
  isProductExtractionURL,
} from '@ziper/product-extraction/link';
import { extractionRules } from './extraction-rules';
import { productSaveApi } from './product-save-api';

type Extract = (
  input: Input<'extractProductV1'>,
  signal: AbortSignal,
) => Promise<Output<'extractProductV1'>>;

export function productSaveWithExtraction(extract: Extract): ProductSaveApi {
  return {
    ...productSaveApi,
    async lookup(url, signal) {
      if (!isProductExtractionURL(url, true)) return productSaveApi.lookup(url, signal);
      const shops = await extractionRules(signal);
      signal.throwIfAborted();
      const metadata = shops.length
        ? await extract({ url, shops }, signal).catch(() => null)
        : null;
      signal.throwIfAborted();
      const lookup = await productSaveApi.lookup(
        metadata?.url ?? canonicalProductExtractionURL(url) ?? url,
        signal,
      );
      const extractedURL = metadata && canonicalProductExtractionURL(metadata.url);
      if (
        lookup.status !== 'ready' ||
        !metadata ||
        !extractedURL ||
        canonicalProductExtractionURL(lookup.url) !== extractedURL
      )
        return lookup;
      const { name, price, imageURL } = metadata;
      return name || price !== null || imageURL
        ? { ...lookup, product: { name, price, imageURL } }
        : lookup;
    },
  };
}
