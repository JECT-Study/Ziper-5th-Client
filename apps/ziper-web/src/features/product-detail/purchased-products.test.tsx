// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ProductDetailError, type ProductPurchases } from '@ziper/api/product-detail';
import { ApiError } from '../../shared/api/http';
import { createPreviewApi, sampleProduct } from './preview';
import { PurchasedProducts } from './purchased-products';
import { deferred } from '../../../../../packages/bridge/test/deferred';

it('offers edit only and does not request details until the user chooses it', async () => {
  const api = createPreviewApi('purchased');
  const list = vi.spyOn(api.purchases, 'list');
  const get = vi.spyOn(api, 'get');
  const onEdit = vi.fn(async () => {});
  const container = document.createElement('div');
  const root = createRoot(container);
  const click = async (element: HTMLButtonElement) => act(() => element.click());
  const label = (text: string) =>
    Array.from(container.querySelectorAll('button')).find((item) => item.textContent === text)!;
  const more = () =>
    container.querySelector<HTMLButtonElement>('article button[aria-label$="상품 관리"]')!;
  try {
    await act(async () =>
      root.render(
        <PurchasedProducts api={api.purchases} onEdit={onEdit} onOpenOriginal={() => {}} />,
      ),
    );
    await click(more());
    expect(container.querySelector('dialog')?.textContent).toBe('상품 관리상품 수정닫기');
    await click(label('닫기'));
    expect(container.querySelector('dialog')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    await click(more());
    await click(label('상품 수정'));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cardId: '1' }));
    expect(list).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
  } finally {
    await act(() => root.unmount());
  }
});

it.each(['auth-required', 'forbidden', 'failed'] as const)(
  'only reports confirmed loss of access when a later page fails with %s',
  async (code) => {
    const api = createPreviewApi('purchased').purchases;
    const list = vi
      .spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockRejectedValueOnce(new ProductDetailError(code));
    const container = document.createElement('div');
    const root = createRoot(container);
    const onAccessDenied = vi.fn();
    try {
      await act(async () =>
        root.render(
          <PurchasedProducts api={api} onAccessDenied={onAccessDenied} onOpenOriginal={() => {}} />,
        ),
      );
      const loadMore = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '더 불러오기',
      )!;
      await act(async () => loadMore.click());
      if (code === 'failed') {
        expect(onAccessDenied).not.toHaveBeenCalled();
        expect(container.querySelector('article')).not.toBeNull();
        expect(container.textContent).toContain('다음 상품을 불러오지 못했어요.');
        expect(container.textContent).toContain('다음 상품 다시 불러오기');
      } else {
        expect(onAccessDenied).toHaveBeenCalledExactlyOnceWith(code, false);
        expect(container.querySelector('article')).toBeNull();
        expect(container.textContent).not.toContain('다시 불러오기');
      }
      expect(list.mock.calls.map(([, , cursor]) => cursor)).toEqual([undefined, 'next']);
    } finally {
      await act(() => root.unmount());
    }
  },
);

it.each(['keyboard', 'pointer', 'moved focus'] as const)(
  'focuses the first new card only after a keyboard page request (%s)',
  async (activation) => {
    const added = { ...sampleProduct, cardId: '2', productTitle: '새로 불러온 상품' };
    const api = createPreviewApi('purchased').purchases;
    let resolvePage!: (page: Awaited<ReturnType<ProductPurchases['list']>>) => void;
    vi.spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(<PurchasedProducts api={api} onOpen={() => {}} onOpenOriginal={() => {}} />),
      );
      const more = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '더 불러오기',
      )!;
      const firstSort = container.querySelector('button')!;
      (activation === 'pointer' ? firstSort : more).focus();
      await act(async () => {
        more.dispatchEvent(
          new MouseEvent('click', { bubbles: true, detail: activation === 'pointer' ? 1 : 0 }),
        );
      });
      expect(container.textContent).toContain('다음 상품을 불러오는 중이에요.');
      if (activation === 'moved focus') firstSort.focus();
      await act(async () => resolvePage({ items: [added], nextCursor: null }));
      const newCard = container.querySelector('article:last-child button');
      expect(newCard?.querySelector('img')?.alt).toBe(added.productTitle);
      expect(document.activeElement).toBe(activation === 'keyboard' ? newCard : firstSort);
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  },
);

it.each(['keyboard', 'pointer', 'moved focus'] as const)(
  'requests focus on the access notice only when the pager still has keyboard focus (%s)',
  async (activation) => {
    const api = createPreviewApi('purchased').purchases;
    let denyAccess!: (error: Error) => void;
    vi.spyOn(api, 'list')
      .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            denyAccess = reject;
          }),
      );
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onAccessDenied = vi.fn();
    try {
      await act(async () =>
        root.render(
          <PurchasedProducts api={api} onAccessDenied={onAccessDenied} onOpenOriginal={() => {}} />,
        ),
      );
      const more = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '더 불러오기',
      )!;
      await act(() =>
        more.dispatchEvent(
          new MouseEvent('click', { bubbles: true, detail: activation === 'pointer' ? 1 : 0 }),
        ),
      );
      if (activation === 'moved focus') container.querySelector('button')!.focus();
      await act(async () => denyAccess(new ProductDetailError('auth-required')));
      expect(onAccessDenied).toHaveBeenCalledExactlyOnceWith(
        'auth-required',
        activation === 'keyboard',
      );
      expect(container.querySelector('article')).toBeNull();
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  },
);

it('keeps retry reachable after a keyboard page request fails, then focuses the new card', async () => {
  const added = { ...sampleProduct, cardId: '2', productTitle: '새로 불러온 상품' };
  const api = createPreviewApi('purchased').purchases;
  const list = vi
    .spyOn(api, 'list')
    .mockResolvedValueOnce({ items: [sampleProduct], nextCursor: 'next' })
    .mockRejectedValueOnce(new Error('temporary error'))
    .mockResolvedValueOnce({ items: [added], nextCursor: null });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(<PurchasedProducts api={api} onOpen={() => {}} onOpenOriginal={() => {}} />),
    );
    const button = (text: string) =>
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === text)!;
    await act(async () => button('더 불러오기').click());
    expect(document.activeElement).toBe(button('다음 상품 다시 불러오기'));
    await act(async () => button('다음 상품 다시 불러오기').click());
    expect(document.activeElement).toBe(container.querySelector('article:last-child button'));
    expect(list.mock.calls.map(([, , cursor]) => cursor)).toEqual([undefined, 'next', 'next']);
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
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
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const button = (text: string) =>
      [...container.querySelectorAll('button')].find((element) => element.textContent === text)!;
    const click = (text: string) => act(async () => button(text).click());
    const retry = '목록 다시 불러오기';
    try {
      await act(async () =>
        root.render(
          <PurchasedProducts
            api={api}
            sort="PRICE_DESC"
            onOpen={() => {}}
            onOpenOriginal={() => {}}
          />,
        ),
      );
      await click('더 불러오기');
      expect(document.activeElement).toBe(button(retry));
      expect(container.querySelector('article')).not.toBeNull();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        '다음 상품을 이어서 불러올 수 없어요.',
      );
      await click(retry);
      if (scenario === 'failed reload') {
        expect(container.textContent).toContain('구매 완료 목록을 갱신하지 못했어요.');
        expect(document.activeElement).toBe(button(retry));
        expect(container.querySelector('article')).not.toBeNull();
        await click(retry);
      }
      if (scenario === 'empty') {
        expect(document.activeElement?.textContent).toBe('구매 완료한 상품이 없어요.');
      } else {
        expect(document.activeElement).toBe(container.querySelector('article button'));
        expect(document.activeElement?.querySelector('img')?.alt).toBe(renamed.productTitle);
      }
      expect(list.mock.calls.map(([sort, , cursor]) => [sort, cursor])).toEqual(
        (scenario === 'failed reload'
          ? [undefined, 'expired', undefined, undefined]
          : [undefined, 'expired', undefined]
        ).map((cursor) => ['PRICE_DESC', cursor]),
      );
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  },
);

it('dismisses a second-page menu when a date refresh replaces that page', async () => {
  const added = { ...sampleProduct, cardId: '2', productTitle: '다음 페이지 상품' };
  const api = createPreviewApi('purchased');
  const list = vi.spyOn(api.purchases, 'list');
  const first = { items: [sampleProduct], nextCursor: 'next' };
  const second = { items: [added], nextCursor: null };
  list
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second);
  const onEdit = vi.fn(async () => {});
  const container = document.createElement('div');
  const root = createRoot(container);
  const button = (label: string) =>
    [...container.querySelectorAll('button')].find(
      (b) => b.textContent === label || b.getAttribute('aria-label') === label,
    )!;
  const click = (label: string) => act(async () => button(label).click());
  const render = (visitRevision: number) =>
    act(async () =>
      root.render(
        <PurchasedProducts
          api={api.purchases}
          sort="OLDEST"
          visitRevision={visitRevision}
          onEdit={onEdit}
          onOpenOriginal={() => {}}
        />,
      ),
    );
  try {
    await render(0);
    await click('더 불러오기');
    await click('다음 페이지 상품 상품 관리');
    expect(container.querySelector('dialog')).not.toBeNull();
    await render(1);
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.querySelector('dialog')).toBeNull();
    await click('더 불러오기');
    expect(container.querySelectorAll('article')).toHaveLength(2);
    expect(container.querySelector('dialog')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    expect(list.mock.calls.map(([, , cursor]) => cursor)).toEqual([
      undefined,
      'next',
      undefined,
      'next',
    ]);
  } finally {
    await act(() => root.unmount());
  }
});

it.each(['OLDEST', 'PRICE_ASC'] as const)(
  'keeps other %s cards when a missing card forces a refresh that fails',
  async (sort) => {
    const remaining = { ...sampleProduct, cardId: '2', productTitle: '구매한 바지' };
    const api = createPreviewApi('purchased').purchases;
    const list = vi
      .fn<ProductPurchases['list']>()
      .mockResolvedValueOnce({ items: [sampleProduct, remaining], nextCursor: 'old' })
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce({ items: [remaining], nextCursor: null });
    api.list = list;
    const onEdit = vi.fn(async () => {});
    const container = document.createElement('div');
    const root = createRoot(container);
    function render(missingCards?: ReadonlySet<string>) {
      return act(async () =>
        root.render(
          <PurchasedProducts
            api={api}
            sort={sort}
            missingCards={missingCards}
            onEdit={onEdit}
            onOpenOriginal={() => {}}
          />,
        ),
      );
    }
    try {
      await render();
      await act(() =>
        container
          .querySelector<HTMLButtonElement>('article button[aria-label$="상품 관리"]')!
          .click(),
      );
      expect(container.querySelector('dialog')).not.toBeNull();
      await render(new Set([sampleProduct.cardId]));
      expect(container.querySelector('dialog')).toBeNull();
      expect(container.querySelector('article')?.textContent).toContain('구매한 바지');
      expect(container.textContent).not.toContain(sampleProduct.productTitle);
      expect(container.textContent).not.toContain('더 불러오기');
      expect(container.textContent).toContain('구매 완료 목록을 갱신하지 못했어요.');
      expect(onEdit).not.toHaveBeenCalled();
      const retry = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === '목록 다시 불러오기',
      )!;
      await act(async () => retry.click());
      expect(container.querySelectorAll('article')).toHaveLength(1);
      expect(list.mock.calls.map(([selected, , cursor]) => [selected, cursor])).toEqual(
        Array.from({ length: 3 }, () => [sort, undefined]),
      );
    } finally {
      await act(() => root.unmount());
    }
  },
);

async function renderList(purchases: ProductPurchases, onOpenOriginal = vi.fn()) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(<PurchasedProducts api={purchases} onOpenOriginal={onOpenOriginal} />),
  );
  const press = (text: string) =>
    act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((item) => item.textContent === text)!
        .click(),
    );
  return {
    container,
    press,
    async [Symbol.asyncDispose]() {
      await act(() => root.unmount());
      container.remove();
    },
  };
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
    items: [{ ...sampleProduct, linkStatus: 'REMOVED' }],
    nextCursor: null,
  });
  const onOpenOriginal = vi.fn();
  await using view = await renderList(purchases, onOpenOriginal);
  const original = Array.from(view.container.querySelectorAll('article button')).find(
    (item) => item.textContent === '원본 상품 접근불가',
  ) as HTMLButtonElement;
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
  const pending = deferred<Awaited<ReturnType<ProductPurchases['list']>>>();
  const list = vi.spyOn(purchases, 'list');
  await using view = await renderList(purchases);
  expect(view.container.querySelectorAll('article')).toHaveLength(2);
  list.mockResolvedValueOnce({
    items: [sampleProduct, { ...sampleProduct, cardId: '3', productTitle: '스트라이프 티셔츠' }],
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
  await act(async () => pending.resolve({ items: [], nextCursor: null }));
  expect(view.container.querySelector('article')?.textContent).toContain('리넨 블라우스');
});
