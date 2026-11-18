// @vitest-environment happy-dom
import type { ProductSaveApi } from '@ziper/api/product-save';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ProductSaveScreen } from './product-save-screen';

it('blocks repeat submits when the save result is unknown', async () => {
  const url = 'https://example.com/product?ref=share!';
  const save = vi.fn<ProductSaveApi['save']>().mockRejectedValue(new Error('response lost'));
  const api: ProductSaveApi = {
    lookup: async () => ({
      status: 'found',
      product: { name: '니트', price: 0, shop: '쇼핑몰', imageURL: null },
    }),
    listBoards: async () => [{ id: 'board-1', name: '기본 보드', productCount: 0 }],
    createBoard: vi.fn(),
    save,
  };
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <ProductSaveScreen
          url={url}
          api={api}
          onClose={() => {}}
          initialDraft={{
            memo: '',
            image: { kind: 'linked-product' },
            tags: ['봄'],
            boardIds: ['board-1'],
          }}
        />,
      );
    });
    const form = container.querySelector('form')!;
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    const send = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await act(async () => {
      send();
      send();
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      '저장 결과를 확인할 수 없어요',
    );
    expect(submit.disabled).toBe(true);
    await act(async () => {
      send();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith({
      url,
      name: '니트',
      price: 0,
      image: { kind: 'linked-product' },
      tags: ['봄'],
      memo: '',
      boardIds: ['board-1'],
    });
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
