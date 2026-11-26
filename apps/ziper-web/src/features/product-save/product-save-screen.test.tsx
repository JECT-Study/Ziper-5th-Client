import { done, unknownOutcome } from '@ziper/api/outcome';
// @vitest-environment happy-dom
import type { ProductLookup, ProductSaveApi } from '@ziper/api/product-save';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductSaveScreen } from './product-save-screen';
import { parseWholeWon } from '@ziper/api/product-fields';
import { ConnectedProductSave } from './connected-product-save';
import { productSaveApi } from './product-save-api';
import type { RuntimeStatus } from '@ziper/bridge/contract';

const bridge = vi.hoisted(() => ({ status: 'initializing' as RuntimeStatus, platform: {} }));
vi.mock('../../bridge/provider', () => ({ usePlatform: () => bridge }));

const url = 'https://shop.example/product';
const container = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;

async function mount(
  save: ProductSaveApi['save'],
  product?: Extract<ProductLookup, { status: 'ready' }>['product'],
  listBoards: ProductSaveApi['listBoards'] = async () => [
    { id: '1', name: '기본 보드', productCount: 0 },
  ],
) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(container);
  const api: ProductSaveApi = {
    lookup: vi
      .fn<ProductSaveApi['lookup']>()
      .mockResolvedValue({ status: 'ready', url, shop: '', product }),
    listBoards,
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
  return api;
}

afterEach(async () => {
  await act(() => root?.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === label,
  )!;

it.each(['ready', 'pending'])('does not start a manual lookup on pagehide: %s', async (phase) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(container);
  const lookup = vi.spyOn(productSaveApi, 'lookup');
  try {
    const ready = { status: 'ready', url, shop: '', product: extractedProduct } as const;
    if (phase === 'pending') lookup.mockImplementationOnce(() => new Promise(() => {}));
    lookup.mockResolvedValue(ready);
    vi.spyOn(productSaveApi, 'listBoards').mockResolvedValue([]);
    const show = (status: RuntimeStatus) => {
      bridge.status = status;
      return act(() => root!.render(<ConnectedProductSave url={url} onClose={() => {}} />));
    };
    await show('web');
    const price = container.querySelector<HTMLInputElement>('input[inputmode=numeric]');
    if (phase === 'ready') {
      await act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          price,
          '36000',
        );
        price!.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await show('closed');
    await show('initializing');
    expect(lookup).toHaveBeenCalledTimes(1);
    if (phase === 'pending') expect(lookup.mock.calls[0]![1].aborted).toBe(true);
    await show('web');
    expect(lookup).toHaveBeenCalledTimes(phase === 'pending' ? 2 : 1);
    if (phase === 'ready') {
      expect(container.querySelector('input[inputmode=numeric]')).toBe(price);
      expect(price?.value).toBe('36000');
    }
  } finally {
    vi.restoreAllMocks();
  }
});

it('accepts whole won amounts without turning malformed input into a different price', () => {
  expect(
    ['0', ' 45,900 ', '1e3', '1,2', '-50', '1,000,000,000', '1000000001'].map(parseWholeWon),
  ).toEqual([0, 45900, null, null, null, 1_000_000_000, null]);
});

const sendForm = () =>
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

const extractedProduct = { name: '니트', price: 35_690, imageURL: 'https://cdn.example/pdp.jpg' };
const linkedPreview = () => container.querySelector(`img[src="${extractedProduct.imageURL}"]`)!;

it('normalizes title and tag limits when saving a new product', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(done({ cardId: '1' }));
  await mount(save, extractedProduct);
  await act(() => button('+직접 추가').click());
  const tag = container.querySelector<HTMLInputElement>('input[aria-label="새 해시태그"]')!;
  const change = (value: string) =>
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(tag, value);
      tag.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await change('가\u200B을');
  expect(button('추가').disabled).toBe(true);
  expect(tag.getAttribute('aria-invalid')).toBe('true');
  await change(`# ${'봄'.normalize('NFD')}`);
  expect(button('추가').disabled).toBe(true);
  await change('💚'.repeat(7));
  expect(button('추가').disabled).toBe(true);
  const valid = '💚'.repeat(6);
  await change(`## ${valid}`);
  await act(() => button('추가').click());
  await act(() => {
    linkedPreview().dispatchEvent(new Event('load'));
    container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
  });
  const title = `${'니'.repeat(198)} 트`;
  const titleInput = [...container.querySelectorAll('input')].find(
    (field) => field.value === '니트',
  )!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      titleInput,
      title.replace(' ', '    '),
    );
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(button('보드에 저장하기').disabled).toBe(false);
  await act(sendForm);
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: title, tags: [valid] }),
  );
});

it('keeps extracted fields and draft edits when only the boards request needs a retry', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(done({ cardId: '1' }));
  const listBoards = vi
    .fn<ProductSaveApi['listBoards']>()
    .mockRejectedValueOnce(new Error('boards unavailable'))
    .mockResolvedValueOnce([{ id: '1', name: '기본 보드', productCount: 0 }]);
  const api = await mount(save, extractedProduct, listBoards);
  expect(container.querySelector('[role=alert]')?.textContent).toContain(
    '보드를 불러오지 못했어요',
  );
  expect(button('보드에 저장하기').disabled).toBe(true);
  expect(button('새 보드 만들기')).toBeUndefined();
  const image = linkedPreview();
  const price = container.querySelector<HTMLInputElement>('input[inputmode=numeric]')!;
  expect(price.value).toBe('35,690');
  await act(() => {
    image.dispatchEvent(new Event('load'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(price, '36000');
    price.dispatchEvent(new Event('input', { bubbles: true }));
    button('봄').click();
  });
  await act(() => button('보드 다시 불러오기').click());
  expect(api.lookup).toHaveBeenCalledTimes(1);
  expect(listBoards).toHaveBeenCalledTimes(2);
  expect(linkedPreview()).toBe(image);
  expect(container.querySelector('[role=alert]')).toBeNull();
  await act(() => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await act(sendForm);
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: '니트', price: 36_000, boardIds: ['1'], tags: ['봄'] }),
  );
});

it('allows retry after a board timeout and ignores the stale response', async () => {
  vi.useFakeTimers();
  const listBoards = vi
    .fn<ProductSaveApi['listBoards']>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ id: '2', name: '이전 응답', productCount: 0 }]), 9_000);
        }),
    )
    .mockResolvedValueOnce([{ id: '1', name: '기본 보드', productCount: 0 }]);
  await mount(vi.fn(), { ...extractedProduct, imageURL: null }, listBoards);
  expect(container.querySelector<HTMLInputElement>('input[inputmode=numeric]')?.value).toBe(
    '35,690',
  );
  expect(container.textContent).toContain('보드를 불러오는 중이에요.');
  await act(() => vi.advanceTimersByTime(8_000));
  expect(listBoards.mock.calls[0]?.[0]?.aborted).toBe(true);
  await act(() => button('보드 다시 불러오기').click());
  await act(() => vi.advanceTimersByTime(1_000));
  expect(container.textContent).toContain('기본 보드');
  expect(container.textContent).not.toContain('이전 응답');
});

it('keeps an overlong extracted title editable and saves all 200 code points after correction', async () => {
  const title = '가'.repeat(199) + '🍑';
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(done({ cardId: '1' }));
  await mount(save, { ...extractedProduct, name: title + '끝' });
  const name = [...container.querySelectorAll('input')].find((e) => e.value === title + '끝')!;
  await act(() => {
    linkedPreview().dispatchEvent(new Event('load'));
    container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    button('봄').click();
  });
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(button('보드에 저장하기').disabled).toBe(true);
  await act(sendForm);
  expect(save).not.toHaveBeenCalled();
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, title);
    name.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(button('보드에 저장하기').disabled).toBe(false);
  await act(sendForm);
  expect(save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: title }));
});

it('only marks the thumbnail ready when the retry actually loads', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(done({ cardId: '1' }));
  await mount(save, extractedProduct);
  const submit = button('보드에 저장하기');
  await act(() => {
    container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    button('봄').click();
  });
  expect(submit.disabled).toBe(true);
  expect(container.textContent).not.toContain('상품 이미지 사용 중');
  const first = linkedPreview();
  await act(() => first.dispatchEvent(new Event('error')));
  const retry = linkedPreview();
  expect(retry).not.toBe(first);
  expect(retry.getAttribute('src')).toBe(extractedProduct.imageURL);
  await act(() => retry.dispatchEvent(new Event('load')));
  expect(linkedPreview()).toBe(retry);
  expect(container.textContent).toContain('상품 이미지 사용 중');
  expect(submit.disabled).toBe(false);
  await act(sendForm);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: { kind: 'linked-product', url: extractedProduct.imageURL } }),
  );
});

it('retains the name and price and allows a template when the thumbnail times out', async () => {
  vi.useFakeTimers();
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(done({ cardId: '1' }));
  await mount(save, extractedProduct);
  const first = linkedPreview();
  await act(() => vi.advanceTimersByTime(4_000));
  expect(linkedPreview()).not.toBe(first);
  await act(() => vi.advanceTimersByTime(4_000));
  expect(linkedPreview()).toBeNull();
  expect(container.textContent).toContain('상품 이미지를 불러오지 못했어요');
  expect(container.textContent).not.toContain('상품 이미지 사용 중');
  await act(() => {
    container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    button('봄').click();
  });
  expect(button('보드에 저장하기').disabled).toBe(true);
  await act(() => button('상의').click());
  await act(sendForm);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      name: '니트',
      price: 35_690,
      image: { kind: 'template', id: 'TOP' },
    }),
  );
});

it('requires the deployed fields and does not resend an uncertain write', async () => {
  const save = vi.fn<ProductSaveApi['save']>().mockResolvedValue(unknownOutcome);
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
  await act(() => {
    sendForm();
    sendForm();
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
