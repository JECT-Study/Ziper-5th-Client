import type { BoardSummary, ProductSaveApi } from '@ziper/api/product-save';
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
  wireId,
} from '../../shared/api/response';

const boards = '/api/v1/boards';
const products = '/api/v1/products';

function boardSummary(value: unknown): BoardSummary {
  const board = object(value);
  const count = board.productCount;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) invalidResponse();
  return { id: id(board.boardId), name: text(board.name), productCount: count };
}

export const productSaveApi: ProductSaveApi = {
  async lookup(input, signal) {
    try {
      const result = object(
        await request(`${products}/url-check`, {
          method: 'POST',
          auth: true,
          signal,
          body: { url: input },
        }),
      );
      if (nullable(id, result.existingCardId)) return { status: 'duplicate' };
      return {
        status: 'ready',
        url: url(result.canonicalUrl),
        shop: nullable(text, result.shop) ?? '',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return { status: 'auth-required' };
        if (error.code === 'INVALID_PRODUCT_URL') return { status: 'unsupported' };
      }
      throw error;
    }
  },
  async listBoards(signal) {
    const result = object(await request(boards, { auth: true, signal }));
    return list(result.boards).map(boardSummary);
  },
  async createBoard(name) {
    return boardSummary(
      await request(boards, {
        method: 'POST',
        auth: true,
        body: { name },
      }),
    );
  },
  async save({
    url: productUrl,
    sharedUrl,
    shop,
    name,
    price,
    image,
    tags,
    memo,
    boardIds,
    metadataSource,
  }) {
    const numericBoardIds = boardIds.map(idNumber);
    let imageFileId: number | null = null;
    if (image.kind === 'upload') {
      const body = new FormData();
      body.append('file', image.file);
      try {
        const result = object(
          await request('/api/v1/files/images', { method: 'POST', auth: true, body }),
        );
        imageFileId = wireId(result.fileId);
      } catch (error) {
        // No product POST has been sent, even if a file upload may have committed.
        return error instanceof ApiError && error.status === 401 ? 'auth-required' : 'failed';
      }
    }
    try {
      const saved = object(
        await request(products, {
          method: 'POST',
          auth: true,
          body: {
            productUrl,
            sharedUrl,
            shop: shop || null,
            productTitle: name,
            price,
            memo: memo || null,
            tags,
            boardIds: numericBoardIds,
            metadataSource,
            imageUrl: image.kind === 'linked-product' ? image.url : null,
            imageFileId,
            fallbackIcon: image.kind === 'template' ? image.id : null,
          },
        }),
      );
      return { cardId: id(saved.cardId) };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return 'auth-required';
        if (error.status === 409 && error.code === 'DUPLICATE_PRODUCT_URL') return 'duplicate';
        if (error.status === 400 || error.status === 403 || error.status === 404) return 'failed';
      }
      // 5xx may follow a successful database commit (JEC-95).
      throw error;
    }
  },
};
