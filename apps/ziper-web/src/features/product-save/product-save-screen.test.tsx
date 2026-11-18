// @vitest-environment happy-dom
import type { ProductSaveApi } from '@ziper/api/product-save';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { parseWholeWon, ProductSaveScreen } from './product-save-screen';

it('accepts whole won amounts without turning malformed input into a different price', () => {
  expect(['0', ' 45,900 ', '9,999,999,999'].map(parseWholeWon)).toEqual([0, 45900, 9999999999]);
  expect(['', '-12.50', '-5000', '1,2', '1e3', '10000000000'].map(parseWholeWon)).toEqual(
    Array(6).fill(null),
  );
});

it('requires a board but lets a manually entered product omit price, image and tags', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue('saved');
  const api: ProductSaveApi = {
    lookup: async () => ({ status: 'manual' }),
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
          url="https://shop.example/product"
          api={api}
          onClose={() => {}}
          initialDraft={{ name: '니트', memo: '', image: null, tags: [], boardIds: [] }}
        />,
      );
    });
    const form = container.querySelector('form')!;
    const submit = container.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(submit.disabled).toBe(true);
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    });
    expect(submit.disabled).toBe(false);
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(save).toHaveBeenCalledExactlyOnceWith({
      url: 'https://shop.example/product',
      name: '니트',
      price: null,
      image: null,
      tags: [],
      memo: '',
      boardIds: ['board-1'],
    });
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

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
