import { useMemo } from 'react';
import {
  ProductDetailError,
  type ProductDetail,
  type ProductDetailApi,
  type ProductPurchases,
} from '@ziper/api/product-detail';
import { ProductDetailScreen } from './product-detail-screen';

export const sampleProduct: ProductDetail = {
  cardId: '1',
  productUrl: 'https://www.musinsa.com/products/1234567',
  shop: '무신사',
  productTitle: '오버핏 울 블렌드 니트 가디건',
  price: 39000,
  memo: '소개팅 때 입을 니트',
  imageUrl: null,
  imageFileId: null,
  imageFileUrl: null,
  fallbackIcon: 'TOP',
  status: 'PLANNED',
  linkStatus: 'AVAILABLE',
  tags: ['가을코디', '위시리스트'],
  boards: [
    { id: '1', name: '기본 보드' },
    { id: '2', name: '가을 코디' },
  ],
};
export function createPreviewApi(mode: string): ProductDetailApi & { purchases: ProductPurchases } {
  let product: ProductDetail = {
    ...sampleProduct,
    status: mode === 'purchased' ? 'PURCHASED' : 'PLANNED',
    linkStatus: mode === 'unavailable' ? 'REMOVED' : 'AVAILABLE',
  };
  if (mode === 'empty')
    product = {
      ...product,
      price: null,
      memo: '',
      tags: [],
      imageUrl: 'https://invalid.example/image.png',
      fallbackIcon: null,
    };
  return {
    async get(_id, signal) {
      signal.throwIfAborted();
      if (mode === 'offline') throw new Error('offline');
      if (mode === 'auth') throw new ProductDetailError('auth-required');
      if (mode === 'not-found') throw new ProductDetailError('not-found');
      return product;
    },
    async listBoards(signal) {
      signal.throwIfAborted();
      return sampleProduct.boards;
    },
    async update(_id, input) {
      if (mode === 'failed') throw new ProductDetailError('failed');
      if (mode === 'unknown') throw new Error('response lost');
      const { boardIds, ...fields } = input;
      product = {
        ...product,
        ...fields,
        boards: sampleProduct.boards.filter((board) => boardIds.includes(board.id)),
      };
      return product;
    },
    purchases: {
      async complete() {
        if (mode === 'failed') throw new ProductDetailError('failed');
        if (mode === 'unknown') throw new Error('response lost');
        product = { ...product, status: 'PURCHASED' };
        return {
          cardId: product.cardId,
          status: 'PURCHASED',
          affectedBoardCount: product.boards.length,
        };
      },
      async list(signal) {
        signal.throwIfAborted();
        return product.status === 'PURCHASED' ? [product] : [];
      },
    },
    async openOriginal() {},
  };
}
export default function ProductDetailPreview({
  mode,
  ...props
}: Omit<Parameters<typeof ProductDetailScreen>[0], 'api'> & { mode: string }) {
  const api = useMemo(() => createPreviewApi(mode), [mode]);
  return <ProductDetailScreen {...props} api={api} />;
}
