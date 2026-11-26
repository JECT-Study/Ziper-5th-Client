// 구매 전환·구매 완료 목록(JEC-79)은 아직 OpenAPI 에 없어 직접 요청한다. 스펙에 나오면 생성 코드로 바꾼다.
import { http } from '@ziper/api/http';
import type { ProductCardDetailResponse } from '@ziper/api/schemas';
import type { ProductSort } from './product-sort';

export const purchasesEnabled = import.meta.env.DEV && import.meta.env.VITE_JEC23_MOCK === '1';

export type PurchasedProduct = Pick<
  ProductCardDetailResponse,
  | 'cardId'
  | 'productUrl'
  | 'shop'
  | 'productTitle'
  | 'imageUrl'
  | 'imageFileUrl'
  | 'fallbackIcon'
  | 'link'
  | 'tags'
> & { price: number | null };

type Reply<T> = { data: T; status: number; headers: Headers };

export const purchaseProduct = (cardId: number) =>
  http<Reply<{ cardId: number; status: 'PURCHASED'; affectedBoardCount: number }>>(
    `/api/v1/products/${cardId}/purchase`,
    { method: 'POST' },
  );

export const getPurchasedProductsQueryKey = (sort: ProductSort) =>
  ['infinite', '/api/v1/products/purchased', { sort }] as const;

export function getPurchasedProducts(sort: ProductSort, cursor?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ sort, size: '20' });
  if (cursor) params.set('cursor', cursor);
  return http<Reply<{ items: PurchasedProduct[]; nextCursor: string | null }>>(
    `/api/v1/products/purchased?${params}`,
    { method: 'GET', signal },
  );
}
