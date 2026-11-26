import { done, rejected, unknownOutcome } from '@ziper/api/outcome';
import {
  ProductDetailError,
  type ProductBoard,
  type ProductDetail,
  type ProductDetailApi,
  type ProductMutation,
  type ProductPurchases,
  type PurchasedProduct,
} from '@ziper/api/product-detail';
import { withDeadline } from '../../shared/api/deadline';
import { ApiError, request } from '../../shared/api/http';
import { decodeProductCardFields } from '../../shared/api/product-card-fields';
import {
  choice,
  count,
  id,
  idNumber,
  invalidResponse,
  list,
  nullable,
  object,
  text,
  url,
} from '../../shared/api/response';
import { isValidPrice } from '@ziper/api/product-fields';

const products = '/api/v1/products';

// The only switch for purchase and purchased-list UI. JEC-79 isn't deployed, so only the
// dev fixture (VITE_JEC23_MOCK=1) enables it; its wire shape is provisional until the OpenAPI ships.
export const purchasesEnabled = import.meta.env.DEV && import.meta.env.VITE_JEC23_MOCK === '1';

function decodeBoard(value: unknown): ProductBoard {
  const board = object(value);
  const productCount = board.productCount === undefined ? undefined : count(board.productCount);
  return { id: id(board.boardId), name: text(board.name), productCount };
}

function decodeCard(card: Record<string, unknown>): PurchasedProduct {
  const price = nullable((value) => (isValidPrice(value) ? value : invalidResponse()), card.price);
  const fields = decodeProductCardFields(card);
  return {
    ...fields,
    cardId: id(card.cardId),
    productUrl: url(card.productUrl),
    shop: fields.shop ?? '',
    price,
  };
}

function decodeProduct(value: unknown, cardId: string): ProductDetail {
  const card = object(value);
  const summary = decodeCard(card);
  if (summary.cardId !== cardId || summary.price === null) invalidResponse();
  return {
    ...summary,
    memo: nullable(text, card.memo) ?? '',
    imageFileId: nullable(id, card.imageFileId),
    imageStatus: choice(card.imageStatus, ['NONE', 'PENDING', 'READY', 'FAILED']),
    status: choice(card.status, ['PLANNED', 'PURCHASED']),
    boards: list(card.boards).map(decodeBoard),
  };
}

function productPath(cardId: string) {
  if (!/^[1-9]\d{0,18}$/.test(cardId) || BigInt(cardId) > 9_223_372_036_854_775_807n) {
    throw new ProductDetailError('not-found');
  }
  return `${products}/${cardId}`;
}

async function authenticated(
  path: string,
  options?: Parameters<typeof request>[1],
): Promise<unknown> {
  try {
    return await request<unknown>(path, { ...options, auth: true });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) throw new ProductDetailError('auth-required');
      if (error.status === 403) throw new ProductDetailError('forbidden');
      if (error.status === 404) {
        if (options?.method === 'PATCH') {
          if (error.code === 'BOARD_NOT_FOUND') throw new ProductDetailError('board-not-found');
          if (error.code === 'FILE_NOT_FOUND') throw new ProductDetailError('image-unusable');
        }
        // A proxy or an unrecognized 404 doesn't confirm that the product is gone.
        if (error.code === 'PRODUCT_CARD_NOT_FOUND') throw new ProductDetailError('not-found');
      }
      // Give list readers the original validation code so they can discard a rejected cursor.
      if (error.status === 400 && options?.method) {
        if (options?.method === 'PATCH' && error.code === 'INVALID_PRODUCT_IMAGE_URL') {
          throw new ProductDetailError('image-unusable');
        }
        throw new ProductDetailError('failed', error.detail);
      }
    }
    // A 5xx (including image-signing failure), network or parsing failure can follow a commit.
    throw error;
  }
}

async function writeWithDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  signal = new AbortController().signal,
): Promise<T> {
  const deadline = withDeadline(signal, 15_000);
  try {
    return await run(deadline.signal);
  } finally {
    deadline.dispose();
  }
}

// A confirmed rejection changed nothing. A 5xx or unreadable reply may follow a commit.
async function mutate<T>(run: (signal: AbortSignal) => Promise<T>): Promise<ProductMutation<T>> {
  try {
    return done(await writeWithDeadline(run));
  } catch (error) {
    return error instanceof ProductDetailError
      ? rejected(error.code, error.detail)
      : unknownOutcome;
  }
}

export const productPurchases: ProductPurchases = {
  complete(cardId) {
    return mutate(async (signal) => {
      const value = object(
        await authenticated(`${productPath(cardId)}/purchase`, { method: 'POST', signal }),
      );
      if (id(value.cardId) !== cardId || value.status !== 'PURCHASED') invalidResponse();
      return {
        cardId,
        status: 'PURCHASED' as const,
        affectedBoardCount: count(value.affectedBoardCount),
      };
    });
  },
  async list(sort, signal, cursor) {
    const query = new URLSearchParams({ sort, size: '20' });
    if (cursor) query.set('cursor', cursor);
    const value = object(
      await authenticated(`${products}/purchased?${query}`, { signal, cache: 'no-store' }),
    );
    return {
      items: list(value.items).map((item) => decodeCard(object(item))),
      nextCursor: nullable(text, value.nextCursor),
    };
  },
};

export const productDetailApi: ProductDetailApi = {
  purchases: purchasesEnabled ? productPurchases : undefined,
  async get(cardId, signal) {
    return decodeProduct(
      await authenticated(productPath(cardId), { signal, cache: 'no-store' }),
      cardId,
    );
  },
  async listBoards(signal) {
    const value = await authenticated('/api/v1/boards', { signal, cache: 'no-store' });
    return list(object(value).boards).map(decodeBoard);
  },
  createBoard(name) {
    return writeWithDeadline(async (signal) => {
      return decodeBoard(
        await authenticated('/api/v1/boards', { method: 'POST', body: { name }, signal }),
      );
    });
  },
  update(cardId, { boardIds, imageFileId, ...input }) {
    return mutate(async (signal) => {
      const value = await authenticated(productPath(cardId), {
        method: 'PATCH',
        signal,
        body: {
          ...input,
          boardIds: boardIds.map(idNumber),
          imageFileId: nullable(idNumber, imageFileId),
        },
      });
      return decodeProduct(value, cardId);
    });
  },
  async openOriginal(cardId, signal) {
    await writeWithDeadline(async (signal) => {
      const value = object(
        await authenticated(`${productPath(cardId)}/open-original`, { method: 'POST', signal }),
      );
      if (id(value.cardId) !== cardId) invalidResponse();
    }, signal);
  },
};
