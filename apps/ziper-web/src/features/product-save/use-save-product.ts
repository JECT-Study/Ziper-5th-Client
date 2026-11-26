import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProductCard, getGetBoardsQueryKey, uploadImage } from '@ziper/api';
import { ApiError } from '@ziper/api/http';
import type { FallbackIcon } from '@ziper/api/product-fields';

export type CardImage =
  | { kind: 'linked-product'; url: string }
  | { kind: 'template'; id: FallbackIcon }
  | { kind: 'upload'; file: File };

export type ProductSaveInput = {
  url: string;
  sharedUrl: string | null;
  shop: string;
  name: string;
  price: number;
  image: CardImage;
  tags: readonly string[];
  memo: string;
  boardIds: readonly number[];
  metadataSource: 'CLIENT' | 'MANUAL';
};

/**
 * - rejected: 서버가 거절해 아무것도 저장되지 않았다.
 * - unknown: 응답 유실·5xx 등으로 이미 저장됐을 수 있어 같은 화면에서 다시 보내지 않는다.
 */
export type ProductSaveResult =
  | { status: 'done'; cardId: number }
  | { status: 'rejected'; reason: 'duplicate' | 'auth-required' | 'failed' }
  | { status: 'unknown' };

async function save({ image, ...input }: ProductSaveInput): Promise<ProductSaveResult> {
  let imageFileId: number | null = null;
  if (image.kind === 'upload') {
    try {
      imageFileId = (await uploadImage({ file: image.file })).data.fileId;
    } catch (error) {
      // 상품 등록은 아직 보내지 않았다.
      return {
        status: 'rejected',
        reason: error instanceof ApiError && error.status === 401 ? 'auth-required' : 'failed',
      };
    }
  }
  try {
    const { data } = await createProductCard({
      productUrl: input.url,
      sharedUrl: input.sharedUrl,
      shop: input.shop || null,
      productTitle: input.name,
      price: input.price,
      memo: input.memo || null,
      tags: [...input.tags],
      boardIds: [...input.boardIds],
      metadataSource: input.metadataSource,
      imageUrl: image.kind === 'linked-product' ? image.url : null,
      imageFileId,
      fallbackIcon: image.kind === 'template' ? image.id : null,
    });
    return { status: 'done', cardId: data.cardId };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'rejected', reason: 'auth-required' };
      if (error.status === 409 && error.code === 'DUPLICATE_PRODUCT_URL')
        return { status: 'rejected', reason: 'duplicate' };
      if ([400, 403, 404].includes(error.status)) return { status: 'rejected', reason: 'failed' };
    }
    return { status: 'unknown' };
  }
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: save,
    onSuccess: (result) => {
      if (result.status === 'done') {
        void queryClient.invalidateQueries({ queryKey: getGetBoardsQueryKey() });
      }
    },
  });
}
