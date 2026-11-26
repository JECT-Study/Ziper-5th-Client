import type { GetBoardProductsSort } from '@ziper/api/schemas';

export type ProductSort = GetBoardProductsSort;

export const productSortLabels = {
  RECENT: '최근 등록순',
  OLDEST: '오래된 순',
  PRICE_ASC: '가격 낮은 순',
  PRICE_DESC: '가격 높은 순',
} as const satisfies Record<ProductSort, string>;

export const productSorts = Object.keys(productSortLabels) as ProductSort[];

export function parseProductSort(value: unknown): ProductSort | undefined {
  return productSorts.find((sort) => sort === value);
}
