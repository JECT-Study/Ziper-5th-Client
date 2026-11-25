import {
  ProductDetailError,
  type ProductBoard,
  type ProductDetail,
  type ProductDetailApi,
} from '@ziper/api/product-detail';
import { ApiError, request } from '../../shared/api/http';
import {
  id,
  idNumber,
  invalidResponse,
  list,
  nullable,
  object,
  text,
  url,
} from '../../shared/api/response';

const products = '/api/v1/products';

function choice<const T extends string>(value: unknown, choices: readonly T[]): T {
  return choices.find((candidate) => candidate === value) ?? invalidResponse();
}

function decodeBoard(value: unknown): ProductBoard {
  const board = object(value);
  return { id: id(board.boardId), name: text(board.name) };
}

function decodeProduct(value: unknown, cardId: string): ProductDetail {
  const card = object(value);
  const price = card.price;
  if (
    id(card.cardId) !== cardId ||
    typeof price !== 'number' ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > 1_000_000_000
  ) {
    invalidResponse();
  }
  return {
    cardId,
    productUrl: url(card.productUrl),
    productTitle: text(card.productTitle),
    shop: nullable(text, card.shop) ?? '',
    price,
    memo: nullable(text, card.memo) ?? '',
    imageUrl: nullable(url, card.imageUrl),
    imageFileId: nullable(id, card.imageFileId),
    imageFileUrl: nullable(url, card.imageFileUrl),
    fallbackIcon:
      card.fallbackIcon === null
        ? null
        : choice(card.fallbackIcon, ['TOP', 'PANTS', 'SKIRT', 'ACCESSORY', 'BEAUTY']),
    status: choice(card.status, ['PLANNED', 'PURCHASED']),
    linkStatus: choice(object(card.link).status, ['AVAILABLE', 'SOLD_OUT', 'REMOVED', 'UNKNOWN']),
    tags: list(card.tags).map((tag) => text(object(tag).title)),
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
      if (error.status === 404) throw new ProductDetailError('not-found');
      if (error.status === 400) throw new ProductDetailError('failed', error.detail);
    }
    // A 5xx (including image-signing failure), network or parsing failure can follow a commit.
    throw error;
  }
}

export const productDetailApi: ProductDetailApi = {
  async get(cardId, signal) {
    return decodeProduct(await authenticated(productPath(cardId), { signal }), cardId);
  },
  async listBoards(signal) {
    const value = await authenticated('/api/v1/boards', { signal });
    return list(object(value).boards).map(decodeBoard);
  },
  async update(cardId, { boardIds, imageFileId, ...input }) {
    const value = await authenticated(productPath(cardId), {
      method: 'PATCH',
      body: {
        ...input,
        boardIds: boardIds.map(idNumber),
        imageFileId: nullable(idNumber, imageFileId),
      },
    });
    return decodeProduct(value, cardId);
  },
  async openOriginal(cardId) {
    await authenticated(`${productPath(cardId)}/open-original`, { method: 'POST' });
  },
};
