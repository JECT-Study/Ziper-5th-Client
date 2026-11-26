import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkUrl } from '@ziper/api';
import { ApiError } from '@ziper/api/http';
import type { Input, Output } from '@ziper/bridge/contract';
import {
  canonicalProductExtractionURL,
  isProductExtractionURL,
} from '@ziper/product-extraction/link';
import { useEffect } from 'react';
import { extractionRules } from './extraction-rules';

export type ExtractProduct = (
  input: Input<'extractProductV1'>,
  signal: AbortSignal,
) => Promise<Output<'extractProductV1'>>;

export type ProductPreview = { name: string; price: number | null; imageURL: string | null };

export type ProductLookup =
  | { status: 'ready'; url: string; shop: string; product?: ProductPreview }
  | { status: 'duplicate' | 'unsupported' | 'auth-required' };

async function checkLink(url: string, signal: AbortSignal): Promise<ProductLookup> {
  try {
    const { data } = await checkUrl({ url }, { signal });
    if (data.existingCardId != null) return { status: 'duplicate' };
    return { status: 'ready', url: data.canonicalUrl, shop: data.shop ?? '' };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'auth-required' };
      if (error.code === 'INVALID_PRODUCT_URL') return { status: 'unsupported' };
    }
    throw error;
  }
}

/** 앱은 지원 쇼핑몰 링크를 먼저 읽고, URL 확인이 같은 상품을 가리킬 때만 읽은 정보를 채운다. */
export async function lookupProduct(
  url: string,
  extract: ExtractProduct | null,
  signal: AbortSignal,
): Promise<ProductLookup> {
  if (!extract || !isProductExtractionURL(url, true)) return checkLink(url, signal);
  const shops = await extractionRules(signal);
  const metadata = shops.length ? await extract({ url, shops }, signal).catch(() => null) : null;
  signal.throwIfAborted();
  const lookup = await checkLink(
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
}

/** paused: 숨겨진 문서는 브릿지를 놓으므로, 끝나지 않은 확인만 멈췄다가 다시 시작한다. */
export function useProductLookup(
  url: string | null,
  extract: ExtractProduct | null,
  paused: boolean,
) {
  const queryClient = useQueryClient();
  const queryKey = ['product-lookup', url, extract !== null] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => lookupProduct(url!, extract, signal),
    enabled: Boolean(url) && !paused,
    staleTime: Infinity,
    gcTime: 0,
  });
  const pausedLookup = paused && query.isPending;
  useEffect(() => {
    if (pausedLookup) void queryClient.cancelQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedLookup, queryClient, url, extract]);
  return query;
}
