import { ApiError } from '@ziper/api/http';

export type ProductErrorCode =
  | 'auth-required'
  | 'forbidden'
  | 'not-found'
  | 'board-not-found'
  | 'image-unusable'
  | 'failed';

/** 서버가 거절해 아무것도 바뀌지 않은 오류. null 이면 5xx·응답 유실 등으로 반영됐을 수 있다. */
export function productRejection(
  error: unknown,
  { edit = false } = {},
): { code: ProductErrorCode; detail?: string } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) return { code: 'auth-required' };
  if (error.status === 403) return { code: 'forbidden' };
  if (error.status === 404) {
    if (edit && error.code === 'BOARD_NOT_FOUND') return { code: 'board-not-found' };
    if (edit && error.code === 'FILE_NOT_FOUND') return { code: 'image-unusable' };
    // 프록시나 알 수 없는 404 는 상품이 사라졌다는 뜻이 아니다.
    if (error.code === 'PRODUCT_CARD_NOT_FOUND') return { code: 'not-found' };
  }
  if (error.status === 400) {
    return edit && error.code === 'INVALID_PRODUCT_IMAGE_URL'
      ? { code: 'image-unusable' }
      : { code: 'failed', detail: error.detail };
  }
  return null;
}

export const readErrorCode = (error: unknown): ProductErrorCode => {
  const code = productRejection(error)?.code;
  return code === 'auth-required' || code === 'forbidden' || code === 'not-found' ? code : 'failed';
};
