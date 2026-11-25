// @vitest-environment happy-dom
import { act } from 'react';
import { BridgeError } from '@ziper/bridge/contract';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductDetailError, type ProductDetailApi } from '@ziper/api/product-detail';
import { ProductDetailScreen } from './product-detail-screen';
import { createPreviewApi, sampleProduct } from './preview';
import { deferred } from '../../../../../packages/bridge/test/deferred';

const mounted: { root: Root; container: HTMLDivElement }[] = [];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
});
afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(() => root.unmount());
    container.remove();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(
  api: ProductDetailApi = createPreviewApi('normal'),
  options: Partial<Parameters<typeof ProductDetailScreen>[0]> = {},
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const props = {
    cardId: '1',
    api,
    manage: vi.fn(async () => null),
    openExternal: vi.fn(async () => {}),
    ...options,
  };
  await act(async () => root.render(<ProductDetailScreen {...props} />));
  return { container, root, props };
}
function button(container: HTMLElement, text: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === text || element.getAttribute('aria-label') === text,
  );
  expect(found, text).toBeDefined();
  return found!;
}
async function click(container: HTMLElement, text: string) {
  await act(async () => button(container, text).click());
}
async function input(container: HTMLElement, label: string, value: string) {
  const field = [...container.querySelectorAll('label')].find(
    (element) => element.textContent === label,
  )!;
  const element = container.querySelector<HTMLInputElement>('#' + CSS.escape(field.htmlFor))!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function edit(api = createPreviewApi('normal')) {
  const result = await mount(api, { manage: async () => 'edit' });
  await click(result.container, '상품 관리');
  return result;
}
async function confirmPurchase(api = createPreviewApi('normal')) {
  const result = await mount(api, { manage: async () => 'purchase' });
  await click(result.container, '상품 관리');
  return result;
}

it('renders the full title and preserves a zero price rather than treating it as missing', async () => {
  const api = createPreviewApi('normal');
  api.get = async () => ({
    ...sampleProduct,
    productTitle: '전체 상품명은 스무 글자보다 길어도 끝까지 모두 표시되어야 해요',
    price: 0,
  });
  const { container } = await mount(api);
  expect(container.querySelector('h2')?.textContent).toBe(
    '전체 상품명은 스무 글자보다 길어도 끝까지 모두 표시되어야 해요',
  );
  expect(container.textContent).toContain('0원');
  expect(container.textContent).toContain('담긴 보드 · 2개');
});
it('offers no purchase actions when the adapter does not support them', async () => {
  const api = { ...createPreviewApi('normal'), purchases: undefined };
  const browser = await mount(api, { manage: undefined });
  await click(browser.container, '상품 관리');
  expect(browser.container.querySelector('dialog')?.textContent).not.toContain('구매 완료');

  const manage = vi.fn(async () => 'purchase' as const);
  const native = await mount(api, { manage });
  await click(native.container, '상품 관리');
  expect(manage).toHaveBeenCalledExactlyOnceWith(false);
  expect(native.container.querySelector('dialog')).toBeNull();

  api.get = async () => ({ ...sampleProduct, status: 'PURCHASED' });
  const { container } = await mount(api);
  expect(container.textContent).toContain('구매 완료한 상품이에요');
  expect(container.textContent).not.toContain('구매 완료 목록 보기');
});
it.each(['auth-required', 'forbidden', 'not-found', 'failed'] as const)(
  'shows a feature-specific %s load error',
  async (code) => {
    const api = createPreviewApi('normal');
    api.get = vi.fn().mockRejectedValue(new ProductDetailError(code));
    const { container } = await mount(api);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(button(container, '다시 확인')).toBeDefined();
  },
);
it('aborts old reads and ignores their late replies after the card changes', async () => {
  const pending = deferred<typeof sampleProduct>();
  let signal: AbortSignal | undefined;
  const api = createPreviewApi('normal');
  api.get = vi
    .fn()
    .mockImplementationOnce((_id, value) => {
      signal = value;
      return pending.promise;
    })
    .mockResolvedValue({ ...sampleProduct, cardId: '2', productTitle: '새 상품' });
  const { container, root, props } = await mount(api);
  await act(async () => root.render(<ProductDetailScreen {...props} cardId="2" />));
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(sampleProduct));
  expect(container.textContent).toContain('새 상품');
  expect(container.textContent).not.toContain(sampleProduct.productTitle);
});
it('composes the browser menu from shared controls and hides out-of-scope actions', async () => {
  const { container } = await mount(createPreviewApi('normal'), { manage: undefined });
  await click(container, '상품 관리');
  expect(container.querySelector('dialog')?.open).toBe(true);
  expect(container.textContent).not.toContain('모든 보드에서 삭제');
  await click(container, '상품 수정');
  expect(container.querySelector('h1')?.textContent).toBe('상품 수정');
});
it('does not call a mutation when the menu or confirmation is cancelled', async () => {
  const api = createPreviewApi('normal');
  const purchase = vi.spyOn(api.purchases, 'complete');
  const result = await mount(api);
  await click(result.container, '상품 관리');
  expect(result.container.querySelector('dialog')).toBeNull();
  const confirmed = await confirmPurchase(api);
  await click(confirmed.container, '취소');
  expect(purchase).not.toHaveBeenCalled();
});
it('deduplicates purchase submits and displays the server-confirmed purchased list', async () => {
  const api = createPreviewApi('normal');
  const original = api.purchases.complete;
  const pending = deferred<void>();
  const purchase = vi.spyOn(api.purchases, 'complete').mockImplementation(async (id) => {
    await pending.promise;
    return original(id);
  });
  const { container } = await confirmPurchase(api);
  await act(() => {
    button(container, '이동하기').click();
    button(container, '이동하기').click();
  });
  expect(purchase).toHaveBeenCalledExactlyOnceWith('1');
  await act(async () => pending.resolve());
  expect(container.querySelector('h1')?.textContent).toBe('구매 완료 목록');
  expect(container.textContent).toContain('1개 · 구매 완료');
  expect(container.textContent).toContain('2개 보드에서 제외');
});
it('requires reconciliation after a lost purchase reply and never blindly resubmits', async () => {
  const api = createPreviewApi('normal');
  const purchase = vi
    .spyOn(api.purchases, 'complete')
    .mockRejectedValue(new Error('response lost'));
  const { container } = await confirmPurchase(api);
  await click(container, '이동하기');
  expect(container.textContent).toContain('구매 처리 결과를 확인할 수 없어요');
  expect(button(container, '상품 관리').disabled).toBe(true);
  api.get = async () => ({ ...sampleProduct, status: 'PURCHASED' });
  await click(container, '현재 상태 확인');
  expect(container.textContent).toContain('구매 완료한 상품이에요');
  expect(purchase).toHaveBeenCalledOnce();
});
it('allows retry after a confirmed no-effects purchase failure', async () => {
  const { container } = await confirmPurchase(createPreviewApi('failed'));
  await click(container, '이동하기');
  expect(container.textContent).toContain('구매 완료로 변경하지 못했어요');
  expect(button(container, '상품 관리').disabled).toBe(false);
});
it('does not repeat a completed purchase when the purchased list fails', async () => {
  const api = createPreviewApi('normal');
  const purchase = vi.spyOn(api.purchases, 'complete');
  api.purchases.list = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([{ ...sampleProduct, status: 'PURCHASED' }]);
  const { container } = await confirmPurchase(api);
  await click(container, '이동하기');
  expect(container.textContent).toContain('완료된 구매 처리는 유지돼요');
  await click(container, '목록 다시 불러오기');
  expect(container.textContent).toContain('1개 · 구매 완료');
  expect(purchase).toHaveBeenCalledOnce();
});
it('keeps saved information visible but disables an unavailable original link', async () => {
  const { container, props } = await mount(createPreviewApi('unavailable'));
  expect(container.textContent).toContain(sampleProduct.memo);
  expect(button(container, '원본 상품 접근불가').disabled).toBe(true);
  expect(props.openExternal).not.toHaveBeenCalled();
});
it('marks sold-out products without blocking the original and falls back from the signed image', async () => {
  const api = createPreviewApi('normal');
  const signed = 'https://storage.example.com/signed';
  const original = 'https://images.example.com/original';
  api.get = async () => ({
    ...sampleProduct,
    imageFileUrl: signed,
    imageUrl: original,
    linkStatus: 'SOLD_OUT',
  });
  const { container } = await mount(api);
  const photo = () => container.querySelector<HTMLImageElement>('figure img')!;
  expect(container.textContent).toContain('품절된 상품이에요');
  expect(button(container, '↗ 원본 쇼핑몰 가기').disabled).toBe(false);
  expect(photo().src).toBe(signed);
  await act(() => photo().dispatchEvent(new Event('error')));
  expect(photo().src).toBe(original);
  await act(() => photo().dispatchEvent(new Event('error')));
  expect(container.querySelector('figcaption')?.textContent).toContain('도안');
});
it('opens the shop before recording the event and never marks a purchase', async () => {
  const api = createPreviewApi('normal');
  const order: string[] = [];
  api.openOriginal = vi.fn(async () => {
    order.push('record');
  });
  const purchase = vi.spyOn(api.purchases, 'complete');
  const { container } = await mount(api, {
    openExternal: async () => {
      order.push('open');
    },
  });
  await click(container, '↗ 원본 쇼핑몰 가기');
  expect(order).toEqual(['open', 'record']);
  expect(purchase).not.toHaveBeenCalled();
});
it('does not misreport a timed-out native opener as a confirmed failure', async () => {
  const { container } = await mount(createPreviewApi('normal'), {
    openExternal: async () => {
      throw new BridgeError('RESULT_UNKNOWN');
    },
  });
  await click(container, '↗ 원본 쇼핑몰 가기');
  expect(container.textContent).toContain('이미 열린 창이 있는지 확인');
});
it('filters vanished boards before the user selects a current destination', async () => {
  const api = createPreviewApi('normal');
  api.listBoards = async () => [{ id: '3', name: '현재 보드' }];
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  expect(button(container, '수정 완료').disabled).toBe(true);
  await click(container, '현재 보드');
  expect(button(container, '수정 완료').disabled).toBe(false);
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledWith('1', expect.objectContaining({ boardIds: ['3'] }));
});
it('does not record an original move if opening is rejected', async () => {
  const api = createPreviewApi('normal');
  const record = vi.spyOn(api, 'openOriginal');
  const { container } = await mount(api, {
    openExternal: async () => {
      throw new Error('blocked');
    },
  });
  await click(container, '↗ 원본 쇼핑몰 가기');
  expect(record).not.toHaveBeenCalled();
  expect(container.textContent).toContain('원본 쇼핑몰을 열지 못했어요');
});
it('distinguishes a failed event record from a failed external opener', async () => {
  const api = createPreviewApi('normal');
  api.openOriginal = async () => {
    throw new Error('offline');
  };
  const { container } = await mount(api);
  await click(container, '↗ 원본 쇼핑몰 가기');
  expect(container.textContent).toContain('쇼핑몰은 열었지만 방문 기록');
});
it('edits existing values and refreshes detail without creating another card', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '상품명', '수정한 전체 상품명');
  await input(container, '가격 (원)', '0');
  await input(container, '해시태그', '#봄, 봄, 여름');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      productTitle: '수정한 전체 상품명',
      price: 0,
      tags: ['봄', '여름'],
      boardIds: ['1', '2'],
    }),
  );
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
  expect(container.textContent).toContain('수정한 전체 상품명');
});
it('enforces the deployed price and tag rules before submitting', async () => {
  const { container } = await edit();
  for (const price of ['', '1e3', '1,000,000,001']) {
    await input(container, '가격 (원)', price);
    expect(button(container, '수정 완료').disabled).toBe(true);
  }
  await input(container, '가격 (원)', '1,000,000,000');
  for (const tags of ['', '일이삼사오육칠']) {
    await input(container, '해시태그', tags);
    expect(button(container, '수정 완료').disabled).toBe(true);
  }
  await input(container, '해시태그', '일이삼사오육');
  expect(button(container, '수정 완료').disabled).toBe(false);
});
it('requires at least one active board', async () => {
  const { container } = await edit();
  await click(container, '기본 보드');
  await click(container, '가을 코디');
  expect(button(container, '수정 완료').disabled).toBe(true);
});
it('blocks duplicate updates and the header back button until a write settles', async () => {
  const api = createPreviewApi('normal');
  const pending = deferred<typeof sampleProduct>();
  const update = vi.spyOn(api, 'update').mockReturnValue(pending.promise);
  const { container } = await edit(api);
  await act(() => {
    button(container, '수정 완료').click();
    button(container, '수정 완료').click();
  });
  await click(container, '뒤로 가기');
  expect(container.querySelector('h1')?.textContent).toBe('상품 수정');
  expect(update).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(sampleProduct));
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
});
it('returns from a normal edit cancel without recording another detail view', async () => {
  const api = createPreviewApi('normal');
  const get = vi.spyOn(api, 'get');
  const { container } = await edit(api);
  await click(container, '취소');
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
  expect(get).toHaveBeenCalledOnce();
});
it('blocks an uncertain update until the user re-reads detail', async () => {
  const api = createPreviewApi('unknown');
  const get = vi.spyOn(api, 'get');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await click(container, '수정 완료');
  expect(container.textContent).toContain('수정 결과를 확인할 수 없어요');
  expect(button(container, '수정 완료').disabled).toBe(true);
  expect(get).toHaveBeenCalledOnce();
  await click(container, '상세에서 확인');
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
  expect(get).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenCalledOnce();
});
it('does not offer deletion, board creation or trash controls', async () => {
  const { container } = await edit();
  expect(container.textContent).not.toMatch(/삭제|복구|새 보드 만들기|휴지통/);
});
