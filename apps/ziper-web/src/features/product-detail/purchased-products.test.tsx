// @vitest-environment happy-dom
import { ApiError, startSession } from '@ziper/api/http';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import { createTestQueryClient, withQuery } from '../../test/query';
import { PurchasedProducts } from './purchased-products';
import { createPreviewApi, Rejection, sampleProduct, serve, type TestApi } from './test-api';
import { deferred } from '../../../../../packages/bridge/test/deferred';

type ProductPurchases = TestApi['purchases'];
type Page = Awaited<ReturnType<ProductPurchases['list']>>;

beforeEach(() => startSession('token'));

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

function mount(purchases: ProductPurchases, attach = true) {
  serve({ ...createPreviewApi('purchased'), purchases });
  const client = createTestQueryClient();
  const container = document.createElement('div');
  if (attach) document.body.append(container);
  const root = createRoot(container);
  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((element) => element.textContent === text)!;
  return {
    container,
    button,
    async render(node: ReactNode) {
      await act(async () => root.render(withQuery(node, client)));
      await settle();
    },
    async run(action: () => void) {
      await act(async () => action());
      await settle();
    },
    async [Symbol.asyncDispose]() {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

it.each(['auth-required', 'forbidden', 'failed'] as const)(
  'only reports confirmed loss of access when a later page fails with %s',
  async (code) => {
    const api = createPreviewApi('purchased').purchases;
    const list = vi
      .spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockRejectedValueOnce(code === 'failed' ? new Error('offline') : new Rejection(code));
    const onAccessDenied = vi.fn();
    await using view = mount(api, false);
    await view.render(
      <PurchasedProducts onAccessDenied={onAccessDenied} onOpenOriginal={() => {}} />,
    );
    await view.run(() => view.button('더 불러오기').click());
    if (code === 'failed') {
      expect(onAccessDenied).not.toHaveBeenCalled();
      expect(view.container.querySelector('article')).not.toBeNull();
      expect(view.container.textContent).toContain('다음 상품을 불러오지 못했어요.');
      expect(view.container.textContent).toContain('다음 상품 다시 불러오기');
    } else {
      expect(onAccessDenied).toHaveBeenCalledExactlyOnceWith(code, false);
      expect(view.container.querySelector('article')).toBeNull();
      expect(view.container.textContent).not.toContain('다시 불러오기');
    }
    expect(list.mock.calls.map(([, , cursor]) => cursor)).toEqual([undefined, 'next']);
  },
);

it.each(['keyboard', 'pointer', 'moved focus'] as const)(
  'focuses the first new card only after a keyboard page request (%s)',
  async (activation) => {
    const added = { ...sampleProduct, cardId: 2, productTitle: '새로 불러온 상품' };
    const api = createPreviewApi('purchased').purchases;
    const page = deferred<Page>();
    vi.spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockReturnValueOnce(page.promise);
    await using view = mount(api);
    await view.render(<PurchasedProducts onOpen={() => {}} onOpenOriginal={() => {}} />);
    const more = view.button('더 불러오기');
    const firstSort = view.container.querySelector('button')!;
    (activation === 'pointer' ? firstSort : more).focus();
    await view.run(() =>
      more.dispatchEvent(
        new MouseEvent('click', { bubbles: true, detail: activation === 'pointer' ? 1 : 0 }),
      ),
    );
    expect(view.container.textContent).toContain('다음 상품을 불러오는 중이에요.');
    if (activation === 'moved focus') firstSort.focus();
    await view.run(() => page.resolve({ items: [added], nextCursor: null }));
    const newCard = view.container.querySelector('article:last-child button');
    expect(newCard?.querySelector('img')?.alt).toBe(added.productTitle);
    expect(document.activeElement).toBe(activation === 'keyboard' ? newCard : firstSort);
  },
);

it.each(['keyboard', 'pointer', 'moved focus'] as const)(
  'requests focus on the access notice only when the pager still has keyboard focus (%s)',
  async (activation) => {
    const api = createPreviewApi('purchased').purchases;
    let denyAccess!: (error: Error) => void;
    vi.spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          denyAccess = reject;
        }),
      );
    const onAccessDenied = vi.fn();
    await using view = mount(api);
    await view.render(
      <PurchasedProducts onAccessDenied={onAccessDenied} onOpenOriginal={() => {}} />,
    );
    await view.run(() =>
      view
        .button('더 불러오기')
        .dispatchEvent(
          new MouseEvent('click', { bubbles: true, detail: activation === 'pointer' ? 1 : 0 }),
        ),
    );
    if (activation === 'moved focus') view.container.querySelector('button')!.focus();
    await view.run(() => denyAccess(new Rejection('auth-required')));
    expect(onAccessDenied).toHaveBeenCalledExactlyOnceWith(
      'auth-required',
      activation === 'keyboard',
    );
    expect(view.container.querySelector('article')).toBeNull();
  },
);

it('keeps retry reachable after a keyboard page request fails, then focuses the new card', async () => {
  const added = { ...sampleProduct, cardId: 2, productTitle: '새로 불러온 상품' };
  const api = createPreviewApi('purchased').purchases;
  const list = vi
    .spyOn(api, 'list')
    .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
    .mockRejectedValueOnce(new Error('temporary error'))
    .mockResolvedValueOnce({ items: [added], nextCursor: null });
  await using view = mount(api);
  await view.render(<PurchasedProducts onOpen={() => {}} onOpenOriginal={() => {}} />);
  await view.run(() => view.button('더 불러오기').click());
  expect(document.activeElement).toBe(view.button('다음 상품 다시 불러오기'));
  await view.run(() => view.button('다음 상품 다시 불러오기').click());
  expect(document.activeElement).toBe(view.container.querySelector('article:last-child button'));
  expect(list.mock.calls.map(([, , cursor]) => cursor)).toEqual([undefined, 'next', 'next']);
});

it.each(['new cursor', 'empty', 'failed reload'] as const)(
  'returns keyboard focus to the start of a reloaded list (%s)',
  async (scenario) => {
    const renamed = { ...sampleProduct, productTitle: '갱신된 상품' };
    const api = createPreviewApi('purchased').purchases;
    const list = vi
      .spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'expired' })
      .mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR'));
    if (scenario === 'failed reload') list.mockRejectedValueOnce(new ApiError(503));
    list.mockResolvedValueOnce(
      scenario === 'empty'
        ? { items: [], nextCursor: null }
        : { items: [renamed], nextCursor: 'fresh' },
    );
    const retry = '목록 다시 불러오기';
    await using view = mount(api);
    const click = (text: string) => view.run(() => view.button(text).click());
    await view.render(
      <PurchasedProducts sort="PRICE_DESC" onOpen={() => {}} onOpenOriginal={() => {}} />,
    );
    await click('더 불러오기');
    expect(document.activeElement).toBe(view.button(retry));
    expect(view.container.querySelector('article')).not.toBeNull();
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      '구매 완료 목록을 불러오지 못했어요.',
    );
    await click(retry);
    if (scenario === 'failed reload') {
      expect(view.container.textContent).toContain('구매 완료 목록을 불러오지 못했어요.');
      expect(document.activeElement).toBe(view.button(retry));
      expect(view.container.querySelector('article')).not.toBeNull();
      await click(retry);
    }
    if (scenario === 'empty') {
      expect(document.activeElement?.textContent).toBe('구매 완료한 상품이 없어요.');
    } else {
      expect(document.activeElement).toBe(view.container.querySelector('article button'));
      expect(document.activeElement?.querySelector('img')?.alt).toBe(renamed.productTitle);
    }
    expect(list.mock.calls.map(([sort, , cursor]) => [sort, cursor])).toEqual(
      (scenario === 'failed reload'
        ? [undefined, 'expired', undefined, undefined]
        : [undefined, 'expired', undefined]
      ).map((cursor) => ['PRICE_DESC', cursor]),
    );
  },
);

it.each(['OLDEST', 'PRICE_ASC'] as const)(
  'keeps other %s cards when a missing card forces a refresh that fails',
  async (sort) => {
    const remaining = { ...sampleProduct, cardId: 2, productTitle: '구매한 바지' };
    const api = createPreviewApi('purchased').purchases;
    const list = vi
      .spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct, remaining], nextCursor: 'old' })
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce({ items: [remaining], nextCursor: null });
    await using view = mount(api);
    const render = (missingCards?: ReadonlySet<number>) =>
      view.render(
        <PurchasedProducts sort={sort} missingCards={missingCards} onOpenOriginal={() => {}} />,
      );
    await render();
    await render(new Set([sampleProduct.cardId]));
    expect(view.container.querySelector('article')?.textContent).toContain('구매한 바지');
    expect(view.container.textContent).not.toContain(sampleProduct.productTitle);
    expect(view.container.textContent).not.toContain('더 불러오기');
    expect(view.container.textContent).toContain('구매 완료 목록을 불러오지 못했어요.');
    await view.run(() => view.button('목록 다시 불러오기').click());
    expect(view.container.querySelectorAll('article')).toHaveLength(1);
    expect(list.mock.calls.map(([selected, , cursor]) => [selected, cursor])).toEqual(
      Array.from({ length: 3 }, () => [sort, undefined]),
    );
  },
);

async function renderList(purchases: ProductPurchases, onOpenOriginal = vi.fn()) {
  const view = mount(purchases);
  await view.render(<PurchasedProducts onOpenOriginal={onOpenOriginal} />);
  return { ...view, press: (text: string) => view.run(() => view.button(text).click()) };
}

it('tries the original image when the signed image fails in a card', async () => {
  const { purchases } = createPreviewApi('purchased');
  const imageFileUrl = 'https://storage.example/signed.webp';
  const imageUrl = 'https://shop.example/original.jpg';
  purchases.list = async () => ({
    items: [{ ...sampleProduct, imageFileUrl, imageUrl }],
    nextCursor: null,
  });
  await using view = await renderList(purchases);
  const photo = () => view.container.querySelector<HTMLImageElement>('article img')!;
  expect(photo().src).toBe(imageFileUrl);
  await act(async () => photo().dispatchEvent(new Event('error')));
  expect(photo().src).toBe(imageUrl);
  await act(async () => photo().dispatchEvent(new Event('error')));
  expect(photo().src).toContain('tops');
});

it('shows an unavailable original link without offering to open it', async () => {
  const { purchases } = createPreviewApi('purchased');
  purchases.list = async () => ({
    items: [{ ...sampleProduct, link: { status: 'REMOVED' } }],
    nextCursor: null,
  });
  const onOpenOriginal = vi.fn();
  await using view = await renderList(purchases, onOpenOriginal);
  const original = view.button('원본 상품 접근불가');
  expect(original.disabled).toBe(true);
  await act(() => original.click());
  expect(onOpenOriginal).not.toHaveBeenCalled();
});

it('renders an empty list without offering pagination', async () => {
  const { purchases } = createPreviewApi('purchased');
  purchases.list = async () => ({ items: [], nextCursor: null });
  await using view = await renderList(purchases);
  expect(view.container.textContent).toContain('구매 완료한 상품이 없어요.');
  expect(view.container.textContent).not.toContain('더 불러오기');
});

it('retries a failed first page', async () => {
  const { purchases } = createPreviewApi('purchased');
  purchases.list = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [sampleProduct], nextCursor: null });
  await using view = await renderList(purchases);
  expect(view.container.textContent).toContain('구매 완료 목록을 불러오지 못했어요');
  await view.press('목록 다시 불러오기');
  expect(view.container.querySelectorAll('article')).toHaveLength(1);
});

it('appends pages without duplicates and drops old responses when the sort changes', async () => {
  const { purchases } = createPreviewApi('purchased');
  const pending = deferred<Page>();
  const list = vi.spyOn(purchases, 'list');
  await using view = await renderList(purchases);
  expect(view.container.querySelectorAll('article')).toHaveLength(2);
  list.mockResolvedValueOnce({
    items: [sampleProduct, { ...sampleProduct, cardId: 3, productTitle: '스트라이프 티셔츠' }],
    nextCursor: null,
  });
  await view.press('더 불러오기');
  expect(list.mock.calls[1]?.[2]).toBe('2');
  expect(view.container.querySelectorAll('article')).toHaveLength(3);

  list.mockReturnValueOnce(pending.promise);
  await view.press('오래된 순');
  const signal = list.mock.calls[2]?.[1];
  await view.press('가격 낮은 순');
  expect(signal?.aborted).toBe(true);
  expect(view.container.querySelector('article')?.textContent).toContain('리넨 블라우스');
  await view.run(() => pending.resolve({ items: [], nextCursor: null }));
  expect(view.container.querySelector('article')?.textContent).toContain('리넨 블라우스');
});
