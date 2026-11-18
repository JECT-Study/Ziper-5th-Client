import type { BoardSummary, ProductSaveApi } from '@ziper/api/product-save';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import previewCard from '../../assets/product-save/preview-card.png';
import { ProductSaveScreen } from './product-save-screen';

export default function ProductSavePreview({
  mode,
  url,
  onClose,
}: {
  mode: string;
  url?: string;
  onClose?: () => void | Promise<unknown>;
}) {
  const [api] = useState(() => createPreviewApi(mode));
  const navigate = useNavigate();
  return (
    <ProductSaveScreen
      url={url ?? 'https://www.musinsa.com/products/1234567'}
      api={api}
      onClose={onClose ?? (() => navigate({ to: '/' }))}
      initialDraft={
        url
          ? undefined
          : {
              name: '오버핏 울 블렌드 니트 가디건',
              memo: '가을용 가디건',
              image: { kind: 'template', id: 'tops' },
              tags: ['여름'],
              boardIds: mode === 'manual' ? ['default'] : ['default', 'fall'],
            }
      }
      savedMessage="프리뷰에서만 저장했어요."
    />
  );
}

function createPreviewApi(mode: string): ProductSaveApi {
  const boards: BoardSummary[] = [
    { id: 'default', name: '기본 보드', productCount: 3 },
    { id: 'fall', name: '가을 코디', productCount: 3 },
    ...['이사 준비', '위시리스트', '출근룩', '여행 준비'].map((name, index) => ({
      id: 'board-' + index,
      name,
      productCount: 3,
    })),
  ];
  return {
    async lookup() {
      if (mode === 'offline') throw new Error('Preview lookup unavailable');
      if (mode === 'manual') return { status: 'manual' };
      if (mode === 'unsupported') return { status: 'unsupported' };
      if (mode === 'auth') return { status: 'auth-required' };
      return {
        status: 'found',
        product: {
          shop: '무신사',
          name: '오버핏 울 블렌드 니트 가디건',
          price: 39000,
          imageURL: previewCard,
        },
      };
    },
    async listBoards() {
      return boards.slice();
    },
    async createBoard(name) {
      const board = { id: 'preview-' + boards.length, name, productCount: 0 };
      boards.unshift(board);
      return board;
    },
    async save() {
      if (mode === 'duplicate') return 'duplicate';
      if (mode === 'failed') return 'failed';
      if (mode === 'unknown') throw new Error('Preview save result unavailable');
      return 'saved';
    },
  };
}
