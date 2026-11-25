// @vitest-environment happy-dom
import type { ProductSaveApi } from '@ziper/api/product-save';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductSaveScreen } from './product-save-screen';
import { parseWholeWon } from './price';

const url = 'https://shop.example/product';
const container = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;

async function mount(save: ProductSaveApi['save']) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(container);
  const api: ProductSaveApi = {
    lookup: async () => ({ status: 'ready', url, shop: '' }),
    listBoards: async () => [{ id: '1', name: '기본 보드', productCount: 0 }],
    createBoard: vi.fn(),
    save,
  };
  await act(() =>
    root!.render(
      <ProductSaveScreen
        url={url}
        api={api}
        onClose={() => {}}
        initialDraft={{ name: '니트', memo: '', image: null, tags: [], boardIds: [] }}
      />,
    ),
  );
}

afterEach(async () => {
  await act(() => root?.unmount());
  vi.unstubAllGlobals();
});

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === label,
  )!;

it('accepts whole won amounts without turning malformed input into a different price', () => {
  expect(['0', ' 45,900 ', '1e3', '1,2', '-50'].map(parseWholeWon)).toEqual([
    0,
    45900,
    null,
    null,
    null,
  ]);
});

it('requires the deployed fields and does not resend an uncertain write', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockRejectedValue(new Error('response lost'));
  await mount(save);
  const submit = button('보드에 저장하기');
  expect(submit.disabled).toBe(true);
  await act(() => {
    container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    button('봄').click();
    button('상의').click();
  });
  expect(submit.disabled).toBe(true);
  const price = container.querySelector('input[inputmode=numeric]')!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(price, '0');
    price.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(submit.disabled).toBe(false);
  const send = () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await act(() => {
    send();
    send();
  });
  expect(save).toHaveBeenCalledExactlyOnceWith({
    url,
    sharedUrl: null,
    shop: '',
    name: '니트',
    price: 0,
    image: { kind: 'template', id: 'TOP' },
    tags: ['봄'],
    memo: '',
    boardIds: ['1'],
    metadataSource: 'MANUAL',
  });
  expect(container.querySelector('[role=alert]')?.textContent).toContain(
    '저장 결과를 확인할 수 없어요',
  );
  expect(submit.disabled).toBe(true);
});
