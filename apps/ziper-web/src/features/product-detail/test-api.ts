// 테스트 전용. 화면은 생성된 클라이언트로 요청하고, 이 가짜 서버가 MSW 로 응답한다.
import { ApiError } from '@ziper/api/http';
import {
  getCreateBoardMockHandler,
  getGetBoardsMockHandler,
  getGetProductCardDetailMockHandler,
  getOpenOriginalUrlMockHandler,
  getReissueMockHandler,
  getUpdateProductCardMockHandler,
} from '@ziper/api/msw';
import type {
  BoardSummaryResponse,
  ProductCardDetailResponse,
  UpdateProductCardRequest,
} from '@ziper/api/schemas';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import type { ProductErrorCode } from './product-errors';
import type { ProductSort } from './product-sort';
import type { PurchasedProduct } from './purchases';

type Product = ProductCardDetailResponse;
export type TestBoard = { boardId: number; name: string; productCount?: number };
type Outcome<T> =
  | { status: 'done'; value: T }
  | { status: 'rejected'; reason: ProductErrorCode; detail?: string }
  | { status: 'unknown' };

export const done = <T>(value: T) => ({ status: 'done', value }) as const;
export const rejected = (reason: ProductErrorCode, detail?: string) =>
  ({ status: 'rejected', reason, detail }) as const;
export const unknownOutcome = { status: 'unknown' } as const;

/** 서버가 확인해 준 거절. 상태 코드로 바뀌어 응답된다. */
export class Rejection extends Error {
  constructor(public readonly code: ProductErrorCode) {
    super(code);
  }
}

const date = new Date('2026-11-22T00:00:00Z');
export const sampleProduct: Product = {
  cardId: 1,
  productUrl: 'https://www.musinsa.com/products/1234567',
  sharedUrl: null,
  shop: '무신사',
  productTitle: '오버핏 울 블렌드 니트 가디건',
  price: 39000,
  memo: '소개팅 때 입을 니트',
  imageUrl: null,
  imageFileId: null,
  imageFileUrl: null,
  imageStatus: 'NONE',
  fallbackIcon: 'TOP',
  metadataSource: 'MANUAL',
  status: 'PLANNED',
  link: { status: 'AVAILABLE' },
  rediscoveryStage: 0,
  lastInteractedAt: date,
  nextRediscoveryAt: date,
  tags: [
    { tagId: 11, title: '가을코디', isDefault: false },
    { tagId: 12, title: '위시리스트', isDefault: false },
  ],
  boards: [
    { boardId: 1, name: '기본 보드', modifiable: false },
    { boardId: 2, name: '가을 코디', modifiable: true },
  ],
  createdAt: date,
  updatedAt: date,
};
export const sampleTags = sampleProduct.tags.map(({ title }) => title);

export type TestApi = {
  get(cardId: number, signal: AbortSignal): Promise<Product>;
  listBoards(signal: AbortSignal): Promise<readonly TestBoard[]>;
  createBoard(name: string): Promise<TestBoard>;
  update(cardId: number, input: UpdateProductCardRequest): Promise<Outcome<Product>>;
  openOriginal(cardId: number, signal: AbortSignal): Promise<void>;
  purchases: {
    complete(
      cardId: number,
    ): Promise<Outcome<{ cardId: number; status: 'PURCHASED'; affectedBoardCount: number }>>;
    list(
      sort: ProductSort,
      signal: AbortSignal,
      cursor?: string,
    ): Promise<{ items: readonly PurchasedProduct[]; nextCursor: string | null }>;
  };
};

export function createPreviewApi(mode: string): TestApi {
  let product: Product = {
    ...sampleProduct,
    status: mode === 'purchased' ? 'PURCHASED' : 'PLANNED',
    link: { status: mode === 'unavailable' ? 'REMOVED' : 'AVAILABLE' },
  };
  if (mode === 'empty') {
    product = {
      ...product,
      memo: null,
      tags: [],
      imageUrl: 'https://invalid.example/image.png',
      fallbackIcon: null,
    };
  }
  let boards: TestBoard[] = sampleProduct.boards.map(({ boardId, name }) => ({ boardId, name }));
  return {
    async get(_id, signal) {
      signal.throwIfAborted();
      if (mode === 'offline') throw new Error('offline');
      if (mode === 'auth') throw new Rejection('auth-required');
      if (mode === 'not-found') throw new Rejection('not-found');
      return product;
    },
    async listBoards(signal) {
      signal.throwIfAborted();
      return boards;
    },
    async createBoard(name) {
      const board = { boardId: boards.length + 1, name };
      boards = [board, ...boards];
      return board;
    },
    async update(_id, { boardIds, tags, ...fields }) {
      if (mode === 'failed') return rejected('failed');
      if (mode === 'unknown') return unknownOutcome;
      product = {
        ...product,
        ...fields,
        tags: tags.map((title, index) => ({ tagId: 100 + index, title, isDefault: false })),
        boards: boards
          .filter((board) => boardIds.includes(board.boardId))
          .map(({ boardId, name }) => ({ boardId, name, modifiable: true })),
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
        const items: PurchasedProduct[] = product.status === 'PURCHASED' ? [product] : [];
        if (mode === 'purchased') {
          items.push(
            { ...product, cardId: 2, productTitle: '리넨 블라우스', price: 29000 },
            { ...product, cardId: 3, productTitle: '스트라이프 티셔츠', price: 49000 },
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

const rejections: Record<ProductErrorCode, [number, string]> = {
  'auth-required': [401, 'UNAUTHORIZED'],
  forbidden: [403, 'FORBIDDEN'],
  'not-found': [404, 'PRODUCT_CARD_NOT_FOUND'],
  'board-not-found': [404, 'BOARD_NOT_FOUND'],
  'image-unusable': [400, 'INVALID_PRODUCT_IMAGE_URL'],
  failed: [400, 'INVALID_REQUEST'],
};

function failure(code: ProductErrorCode, detail?: string) {
  const [status, name] = rejections[code];
  return HttpResponse.json({ status, code: name, detail }, { status });
}

/** 성공은 본문으로, 거절은 상태 코드로, 알 수 없는 결과는 500, 그 밖의 오류는 연결 실패로 응답한다. */
async function reply<T>(run: () => Promise<T | Outcome<T>>): Promise<T> {
  let result: T | Outcome<T>;
  try {
    result = await run();
  } catch (error) {
    if (error instanceof Rejection) throw failure(error.code);
    if (error instanceof ApiError) {
      throw HttpResponse.json({ code: error.code }, { status: error.status });
    }
    throw HttpResponse.error();
  }
  if (result && typeof result === 'object' && 'status' in result) {
    const outcome = result as Outcome<T>;
    if (outcome.status === 'done') return outcome.value;
    if (outcome.status === 'rejected') throw failure(outcome.reason, outcome.detail);
    if (outcome.status === 'unknown') throw new HttpResponse(null, { status: 500 });
  }
  return result as T;
}

const boardResponse = (board: TestBoard): BoardSummaryResponse => ({
  modifiable: true,
  previewImages: [],
  createdAt: date,
  ...board,
  productCount: board.productCount ?? 0,
});

/** 화면이 보내는 요청을 api 의 메서드로 넘긴다. 메서드는 요청 때마다 다시 읽어 바꿔 끼울 수 있다. */
export function serve(api: TestApi) {
  const handlers = [
    http.get('*/api/v1/products/purchased', ({ request }) =>
      reply(async () => {
        const params = new URL(request.url).searchParams;
        return api.purchases.list(
          params.get('sort') as ProductSort,
          request.signal,
          params.get('cursor') ?? undefined,
        );
      }).then((body) => HttpResponse.json(body)),
    ),
    http.post('*/api/v1/products/:cardId/purchase', ({ params }) =>
      reply(() => api.purchases.complete(Number(params.cardId))).then((body) =>
        HttpResponse.json(body),
      ),
    ),
    getReissueMockHandler(() => {
      throw new HttpResponse(null, { status: 401 });
    }),
    getGetProductCardDetailMockHandler(({ params, request }) =>
      reply(() => api.get(Number(params.cardId), request.signal)),
    ),
    getUpdateProductCardMockHandler(async ({ params, request }) => {
      const input = (await request.json()) as UpdateProductCardRequest;
      return reply(() => api.update(Number(params.cardId), input));
    }),
    getOpenOriginalUrlMockHandler(({ params, request }) =>
      reply(async () => {
        await api.openOriginal(Number(params.cardId), request.signal);
        return {
          cardId: Number(params.cardId),
          productUrl: sampleProduct.productUrl,
          rediscoveryStage: 0,
          lastInteractedAt: date,
          nextRediscoveryAt: date,
        };
      }),
    ),
    getGetBoardsMockHandler(({ request }) =>
      reply(async () => ({
        boards: (await api.listBoards(request.signal)).map(boardResponse),
        purchasedSummary: { productCount: 0, previewImages: [] },
      })),
    ),
    getCreateBoardMockHandler(async ({ request }) => {
      const { name } = (await request.json()) as { name: string };
      return reply(async () => {
        const { previewImages: _, ...board } = boardResponse(await api.createBoard(name));
        return board;
      });
    }),
  ];
  server.use(...handlers);
}
