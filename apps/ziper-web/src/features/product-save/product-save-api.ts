import type { BoardSummary, ProductSaveApi } from '@ziper/api/product-save';
import { done, rejected, unknownOutcome } from '@ziper/api/outcome';
import { isGatewayFailure, withDeadline } from '../../shared/api/deadline';
import { ApiError, parseResponse, request, requestResponse } from '../../shared/api/http';
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

async function checkProductUrl(input: string, signal: AbortSignal) {
  const budget = withDeadline(signal, 5_000);
  const stopped = new Promise<never>((_, reject) => {
    budget.signal.addEventListener('abort', () => reject(budget.signal.reason), { once: true });
  });
  const check = async (retried = false): Promise<unknown> => {
    let response: Response | undefined;
    try {
      response = await requestResponse(`${products}/url-check`, {
        method: 'POST',
        auth: true,
        signal: budget.signal,
        body: { url: input },
      });
      return await parseResponse(response);
    } catch (error) {
      budget.signal.throwIfAborted();
      // A 200 parse only throws if reading the body fails; schema checks happen below.
      const transient = response
        ? isGatewayFailure(response) ||
          (response.status === 200 && !response.headers.has('Retry-After'))
        : error instanceof TypeError;
      // URL check is read-only, unlike product registration. Keep the same URL and deadline.
      if (!retried && transient) return check(true);
      throw error;
    }
  };
  try {
    return object(await Promise.race([check(), stopped]));
  } finally {
    budget.dispose();
  }
}

export const productSaveApi: ProductSaveApi = {
  async lookup(input, signal) {
    try {
      const result = await checkProductUrl(input, signal);
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
        return rejected(
          error instanceof ApiError && error.status === 401 ? 'auth-required' : 'failed',
        );
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
      return done({ cardId: id(saved.cardId) });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return rejected('auth-required');
        if (error.status === 409 && error.code === 'DUPLICATE_PRODUCT_URL')
          return rejected('duplicate');
        if (error.status === 400 || error.status === 403 || error.status === 404)
          return rejected('failed');
      }
      // 5xx, a lost reply or an unreadable body may follow a database commit (JEC-95).
      return unknownOutcome;
    }
  },
};
