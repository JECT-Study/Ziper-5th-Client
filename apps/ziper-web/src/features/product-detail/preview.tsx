import { done, rejected, unknownOutcome } from '@ziper/api/outcome';
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
  imageStatus: 'NONE',
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
  let boards = [...sampleProduct.boards];
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
      return boards;
    },
    async createBoard(name) {
      const board = { id: String(boards.length + 1), name };
      boards = [board, ...boards];
      return board;
    },
    async update(_id, input) {
      if (mode === 'failed') return rejected('failed');
      if (mode === 'unknown') return unknownOutcome;
      const { boardIds, ...fields } = input;
      product = {
        ...product,
        ...fields,
        boards: boards.filter((board) => boardIds.includes(board.id)),
      };
      return done(product);
    },
    purchases: {
      async complete() {
        if (mode === 'failed') return rejected('failed');
        if (mode === 'unknown') return unknownOutcome;
        product = { ...product, status: 'PURCHASED' };
        return done({
          cardId: product.cardId,
          status: 'PURCHASED' as const,
          affectedBoardCount: product.boards.length,
        });
      },
      async list(sort, signal, cursor) {
        signal.throwIfAborted();
        const items = product.status === 'PURCHASED' ? [product] : [];
        if (mode === 'purchased') {
          items.push(
            { ...product, cardId: '2', productTitle: '리넨 블라우스', price: 29000 },
            { ...product, cardId: '3', productTitle: '스트라이프 티셔츠', price: 49000 },
          );
        }
        if (sort === 'OLDEST') items.reverse();
        if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') {
          const direction = sort === 'PRICE_ASC' ? 1 : -1;
          items.sort((a, b) => ((a.price ?? 0) - (b.price ?? 0)) * direction);
        }
        const start = cursor === '2' ? 2 : 0;
        return {
          items: items.slice(start, start + 2),
          nextCursor: items.length > start + 2 ? '2' : null,
        };
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
