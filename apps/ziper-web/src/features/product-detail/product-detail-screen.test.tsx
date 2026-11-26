// @vitest-environment happy-dom
import { act, StrictMode } from 'react';
import { done, rejected, unknownOutcome } from '@ziper/api/outcome';
import { BridgeError } from '@ziper/bridge/contract';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductDetailError, type ProductDetailApi } from '@ziper/api/product-detail';
import { showToast } from '../../components';
import { ApiError } from '../../shared/api/http';
import { ProductDetailScreen } from './product-detail-screen';
import { createPreviewApi, sampleProduct } from './preview';
import { deferred } from '../../../../../packages/bridge/test/deferred';

vi.mock('../../components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components')>()),
  showToast: vi.fn((message: string) => ({ id: 1, message })),
}));

const mounted: { root: Root; container: HTMLDivElement }[] = [];
beforeEach(() => {
  vi.mocked(showToast).mockClear();
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
    openExternal: vi.fn(async () => {}),
    openPurchased: vi.fn(async () => {}),
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
  const board = [...container.querySelectorAll<HTMLLabelElement>('label')].find(
    (label) => label.textContent === text && label.querySelector('input[type="checkbox"]'),
  );
  await act(async () => (board?.querySelector('input') ?? button(container, text)).click());
}
async function input(container: HTMLElement, label: string, value: string) {
  const field = [...container.querySelectorAll('label')].find(
    (element) => element.textContent === label,
  );
  const element = field
    ? container.querySelector<HTMLInputElement>('#' + CSS.escape(field.htmlFor))!
    : [...container.querySelectorAll<HTMLInputElement>('input')].find(
        (input) => input.getAttribute('aria-label') === label,
      )!;
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function edit(
  api = createPreviewApi('normal'),
  options?: Partial<Parameters<typeof ProductDetailScreen>[0]>,
) {
  const result = await mount(api, options);
  await click(result.container, '상품 관리');
  await click(result.container, '상품 수정');
  return result;
}
async function confirmPurchase(api = createPreviewApi('normal')) {
  const result = await mount(api);
  await click(result.container, '상품 관리');
  await click(result.container, '구매 완료');
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
it('sends one detail read even if React probes effects in Strict Mode', async () => {
  const api = createPreviewApi('normal');
  const get = vi.spyOn(api, 'get');
  const { root, props } = await mount(api);
  get.mockClear();
  await act(async () =>
    root.render(
      <StrictMode>
        <ProductDetailScreen {...props} />
      </StrictMode>,
    ),
  );
  expect(get).toHaveBeenCalledOnce();
});

it('does not open the edit shortcut while leaving the loading detail', async () => {
  const api = createPreviewApi('normal');
  const detail = deferred<typeof sampleProduct>();
  const navigation = deferred<void>();
  const get = vi.spyOn(api, 'get').mockReturnValue(detail.promise);
  const list = vi.spyOn(api, 'listBoards');
  const onInitialActionHandled = vi.fn();
  const onBack = vi.fn(async () => {
    await navigation.promise;
    throw new Error('Navigation failed');
  });
  const { container } = await mount(api, {
    initialAction: 'edit',
    onInitialActionHandled,
    onBack,
  });
  await click(container, '뒤로 가기');
  await act(async () => detail.resolve(sampleProduct));
  expect(onBack).toHaveBeenCalledOnce();
  expect(onInitialActionHandled).toHaveBeenCalledOnce();
  expect(container.querySelector('dialog')).toBeNull();
  expect(list).not.toHaveBeenCalled();
  await act(async () => navigation.resolve());
  expect(container.textContent).toContain('이전 화면으로 돌아가지 못했어요.');
  await click(container, '상품 관리');
  expect(container.querySelector('dialog h2')?.textContent).toBe('상품 관리');
  expect(get).toHaveBeenCalledOnce();
});

it('prevents the purchased shortcut and original opener from interrupting header Back', async () => {
  const api = createPreviewApi('purchased');
  const pending = deferred<void>();
  const onBack = vi.fn(() => pending.promise);
  const returnTo = vi.fn(async () => {});
  const openExternal = vi.fn(async () => {});
  const { container } = await mount(api, { openPurchased: returnTo, onBack, openExternal });
  await act(() => {
    button(container, '뒤로 가기').click();
    button(container, '구매 완료 목록 보기').click();
    button(container, '원본 쇼핑몰로 이동').click();
    button(container, '상품 관리').click();
  });
  expect(onBack).toHaveBeenCalledOnce();
  expect(returnTo).not.toHaveBeenCalled();
  expect(openExternal).not.toHaveBeenCalled();
  expect(container.querySelector('dialog')).toBeNull();
  await act(async () => pending.resolve());
});

it.each([
  ['unknown', 'keyboard'],
  ['unknown', 'pointer'],
  ['auth-required', 'keyboard'],
] as const)(
  'focuses the purchase confirmation message after %s only for keyboard activation (%s)',
  async (result, activation) => {
    const api = createPreviewApi('normal');
    const response = result === 'unknown' ? unknownOutcome : rejected('auth-required');
    const pending = deferred<typeof response>();
    const complete = vi.spyOn(api.purchases, 'complete').mockReturnValue(pending.promise);
    const get = vi.spyOn(api, 'get');
    const { container } = await mount(api, { onSignIn: vi.fn() });
    const manage = button(container, '상품 관리');
    manage.focus();
    await click(container, '상품 관리');
    await click(container, '구매 완료');
    const confirm = button(container, '이동하기');
    await act(() => {
      confirm.focus();
      confirm.dispatchEvent(
        new MouseEvent('click', { bubbles: true, detail: activation === 'pointer' ? 1 : 0 }),
      );
    });
    expect(confirm.disabled).toBe(true);
    await act(() => pending.resolve(response));
    expect(container.querySelector('dialog')).toBeNull();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      result === 'auth-required' ? '로그인한 뒤' : '결과를 확인할 수 없어요',
    );
    expect(document.activeElement === alert).toBe(activation === 'keyboard');
    expect(get).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  },
);

it('focuses the purchase result instead of the original-link action after a keyboard check', async () => {
  const api = createPreviewApi('normal');
  const complete = vi.spyOn(api.purchases, 'complete').mockResolvedValue(unknownOutcome);
  const { container } = await confirmPurchase(api);
  await click(container, '이동하기');
  const get = vi.spyOn(api, 'get').mockResolvedValue({ ...sampleProduct, status: 'PURCHASED' });
  await click(container, '현재 상태 확인');
  expect(document.activeElement?.textContent).toBe('✓ 구매 완료한 상품이에요');
  expect(button(container, '구매 완료 목록 보기')).toBeDefined();
  expect(get).toHaveBeenCalledOnce();
  expect(complete).toHaveBeenCalledOnce();
});

it.each(['auth-required', 'forbidden'] as const)(
  'hides stale detail after purchase returns %s',
  async (reason) => {
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get');
    const rejectedAction = vi.fn(async () => rejected(reason));
    api.purchases.complete = rejectedAction;
    const onSignIn = vi.fn(async () => {});
    const { container } = await mount(api, { onSignIn });
    await click(container, '상품 관리');
    await click(container, '구매 완료');
    await click(container, '이동하기');
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('[aria-label="상품 관리"]')).toBeNull();
    expect(container.textContent).not.toMatch(/원본 쇼핑몰로 이동|현재 상태 확인|휴지통으로 이동/);
    expect(get).toHaveBeenCalledOnce();
    if (reason === 'auth-required') {
      await click(container, '로그인 화면으로 이동');
      expect(onSignIn).toHaveBeenCalledOnce();
      expect(get).toHaveBeenCalledOnce();
    } else {
      expect(container.textContent).toContain('이 상품의 상태를 변경할 권한이 없어요.');
      expect(container.textContent).not.toContain('로그인 화면으로 이동');
      await click(container, '다시 확인');
      expect(get).toHaveBeenCalledTimes(2);
      expect(container.querySelector('main h2')?.textContent).toBe(sampleProduct.productTitle);
    }
    expect(rejectedAction).toHaveBeenCalledOnce();
  },
);

it('offers no purchase actions when the adapter does not support them', async () => {
  const api = { ...createPreviewApi('normal'), purchases: undefined };
  const browser = await mount(api);
  await click(browser.container, '상품 관리');
  expect(browser.container.querySelector('dialog')?.textContent).not.toContain('구매 완료');

  api.get = async () => ({ ...sampleProduct, status: 'PURCHASED' });
  const { container } = await mount(api, { openPurchased: undefined });
  expect(container.textContent).toContain('구매 완료한 상품이에요');
  expect(container.textContent).not.toContain('구매 완료 목록 보기');
});
it.each(['auth-required', 'forbidden', 'not-found', 'failed'] as const)(
  'shows a feature-specific %s load error',
  async (code) => {
    const api = createPreviewApi('normal');
    api.get = vi.fn().mockRejectedValue(new ProductDetailError(code));
    const { container } = await mount(api);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    if (code === 'not-found') expect(alert?.textContent).toContain('상품을 찾을 수 없어요.');
    expect(container.querySelector('main h2, main figure, [aria-label="상품 관리"]')).toBeNull();
    expect(container.textContent).not.toContain('원본 쇼핑몰로 이동');
    expect(button(container, '다시 확인')).toBeDefined();
  },
);
it.each(['auth-required', 'forbidden'] as const)(
  'offers sign-in only for %s when the session is required',
  async (code) => {
    const api = createPreviewApi('normal');
    api.get = vi.fn().mockRejectedValue(new ProductDetailError(code));
    const onSignIn = vi.fn(async () => {});
    const { container } = await mount(api, { onSignIn });
    if (code === 'auth-required') await click(container, '로그인 화면으로 이동');
    else expect(container.textContent).not.toContain('로그인 화면으로 이동');
    expect(onSignIn).toHaveBeenCalledTimes(code === 'auth-required' ? 1 : 0);
    expect(api.get).toHaveBeenCalledOnce();
  },
);
it('serializes sign-in navigation from expired detail and permits retry after failure', async () => {
  const api = createPreviewApi('auth');
  const get = vi.spyOn(api, 'get');
  const first = deferred<void>();
  const onSignIn = vi
    .fn(async () => {})
    .mockImplementationOnce(async () => {
      await first.promise;
      throw new Error('navigation failed');
    });
  const onBack = vi.fn();
  const { container } = await mount(api, { onSignIn, onBack });
  const signIn = button(container, '로그인 화면으로 이동');
  await act(() => {
    signIn.click();
    signIn.click();
    button(container, '뒤로 가기').click();
  });
  expect(onSignIn).toHaveBeenCalledOnce();
  expect(onBack).not.toHaveBeenCalled();
  expect(signIn.disabled).toBe(true);
  await act(async () => first.resolve());
  expect(container.textContent).toContain('로그인 화면을 열지 못했어요.');
  expect(signIn.disabled).toBe(false);
  await click(container, '로그인 화면으로 이동');
  expect(onSignIn).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledOnce();
});

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
it('composes the shared menu and hides out-of-scope actions', async () => {
  const { container } = await mount();
  await click(container, '상품 관리');
  expect(container.querySelector('dialog')?.open).toBe(true);
  expect(container.textContent).not.toContain('모든 보드에서 삭제');
  await click(container, '상품 수정');
  expect(container.querySelector('dialog h2')?.textContent).toBe('상품 수정');
});
it('does not call a mutation when the menu or confirmation is cancelled', async () => {
  const api = createPreviewApi('normal');
  const purchase = vi.spyOn(api.purchases, 'complete');
  const result = await mount(api);
  await click(result.container, '상품 관리');
  await click(result.container, '닫기');
  expect(result.container.querySelector('dialog')).toBeNull();
  const confirmed = await confirmPurchase(api);
  await click(confirmed.container, '취소');
  expect(purchase).not.toHaveBeenCalled();
});
it('deduplicates purchase submits and opens the purchased list once', async () => {
  const api = createPreviewApi('normal');
  const original = api.purchases.complete;
  const pending = deferred<void>();
  const purchase = vi.spyOn(api.purchases, 'complete').mockImplementation(async (id) => {
    await pending.promise;
    return original(id);
  });
  const { container, props } = await confirmPurchase(api);
  await act(() => {
    button(container, '이동하기').click();
    button(container, '이동하기').click();
  });
  expect(purchase).toHaveBeenCalledExactlyOnceWith('1');
  await act(async () => pending.resolve());
  expect(props.openPurchased).toHaveBeenCalledExactlyOnceWith(true);
  expect(container.querySelector('dialog')).toBeNull();
});
it('keeps a pending purchase open and ignores its reply after the screen is gone', async () => {
  const api = createPreviewApi('normal');
  const result = deferred<Awaited<ReturnType<typeof api.purchases.complete>>>();
  const complete = vi.spyOn(api.purchases, 'complete').mockReturnValue(result.promise);
  const openPurchased = vi.fn(async () => {});
  const { container, root } = await mount(api, { openPurchased });
  await click(container, '상품 관리');
  await click(container, '구매 완료');
  await click(container, '이동하기');
  expect(button(container, '취소').disabled).toBe(true);
  await act(async () => {
    container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
  });
  expect(container.querySelector('dialog')?.open).toBe(true);
  await act(async () => root.render(null));
  await act(async () =>
    result.resolve(done({ cardId: '1', status: 'PURCHASED', affectedBoardCount: 2 })),
  );
  expect(complete).toHaveBeenCalledOnce();
  expect(openPurchased).not.toHaveBeenCalled();
});

it('requires reconciliation after a lost purchase reply and never blindly resubmits', async () => {
  const api = createPreviewApi('normal');
  const purchase = vi
    .spyOn(api.purchases, 'complete')
    .mockRejectedValue(new Error('response lost'));
  const openPurchased = vi.fn(async () => {});
  const { container } = await mount(api, { openPurchased });
  await click(container, '상품 관리');
  await click(container, '구매 완료');
  await click(container, '이동하기');
  expect(container.textContent).toContain('구매 처리 결과를 확인할 수 없어요');
  expect(button(container, '상품 관리').disabled).toBe(true);
  const get = vi
    .spyOn(api, 'get')
    .mockRejectedValueOnce(new ApiError(503))
    .mockResolvedValueOnce({ ...sampleProduct, status: 'PURCHASED' });
  await click(container, '현재 상태 확인');
  expect(container.textContent).toContain('구매 상태를 확인하지 못했어요');
  expect(container.querySelector('[aria-label="상품 관리"]')).toBeNull();
  expect(purchase).toHaveBeenCalledOnce();
  await click(container, '현재 상태 확인');
  expect(get).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('구매 완료한 상품이에요');
  expect(openPurchased).not.toHaveBeenCalled();
  await click(container, '구매 완료 목록 보기');
  expect(openPurchased).toHaveBeenCalledExactlyOnceWith(true);
  expect(purchase).toHaveBeenCalledOnce();
});
it('rechecks a rejected purchase before allowing a new confirmation', async () => {
  const api = createPreviewApi('failed');
  const purchase = vi.spyOn(api.purchases, 'complete');
  const get = vi.spyOn(api, 'get');
  const { container } = await confirmPurchase(api);
  await click(container, '이동하기');
  expect(container.textContent).toContain('구매 완료로 변경하지 못했어요');
  expect(button(container, '상품 관리').disabled).toBe(true);
  await click(container, '현재 상태 확인');
  expect(button(container, '상품 관리').disabled).toBe(false);
  expect(container.textContent).toContain('아직 구매 예정 상품이에요');
  expect(get).toHaveBeenCalledTimes(2);
  expect(purchase).toHaveBeenCalledOnce();
});
it('opens the independent route after the mutation without starting an inline list request', async () => {
  const api = createPreviewApi('normal');
  const list = vi.spyOn(api.purchases, 'list');
  const openPurchased = vi.fn(async () => {});
  const { container } = await mount(api, { openPurchased });
  await click(container, '상품 관리');
  await click(container, '구매 완료');
  await click(container, '이동하기');
  expect(openPurchased).toHaveBeenCalledExactlyOnceWith(true);
  expect(list).not.toHaveBeenCalled();
});

it('returns from a missing purchased card without requesting its detail again', async () => {
  const api = createPreviewApi('not-found');
  const get = vi.spyOn(api, 'get');
  const openPurchased = vi.fn(async () => {});
  const { container } = await mount(api, { openPurchased, fromPurchasedList: true });
  expect(container.textContent).toContain('상품을 찾을 수 없어요.');
  expect(container.textContent).not.toMatch(/다시 확인|휴지통/);
  await click(container, '구매 완료 목록 보기');
  expect(openPurchased).toHaveBeenCalledExactlyOnceWith(false);
  expect(get).toHaveBeenCalledOnce();
});

it('allows only one return to the purchased list while navigation is pending', async () => {
  const navigation = deferred<void>();
  const openPurchased = vi.fn(async () => {
    await navigation.promise;
    throw new Error('navigation failed');
  });
  const api = createPreviewApi('purchased');
  const purchase = vi.spyOn(api.purchases, 'complete');
  const { container } = await mount(api, { openPurchased });
  const back = button(container, '구매 완료 목록 보기');
  await act(() => {
    back.click();
    back.click();
  });
  expect(back.disabled).toBe(true);
  expect(back.getAttribute('aria-busy')).toBe('true');
  expect(openPurchased).toHaveBeenCalledExactlyOnceWith(false);
  expect(purchase).not.toHaveBeenCalled();
  await act(async () => navigation.resolve());
  expect(container.textContent).toContain('구매 완료 목록을 열지 못했어요');
  expect(back.disabled).toBe(false);
});

it.each([
  ['PANTS', 'pants'],
  ['SKIRT', 'skirt'],
  ['ACCESSORY', 'accessory'],
  ['BEAUTY', 'beauty'],
] as const)(
  'shows the detail-size %s artwork when the card has a category and no photo',
  async (fallbackIcon, filename) => {
    const api = createPreviewApi('normal');
    vi.spyOn(api, 'get').mockResolvedValue({ ...sampleProduct, fallbackIcon });
    const { container } = await mount(api);
    const image = container.querySelector<HTMLImageElement>('figure img');
    expect(image?.src).toContain(`product-detail/${filename}.webp`);
    expect(image?.alt).toBe(sampleProduct.productTitle);
  },
);

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
  expect(button(container, '원본 쇼핑몰로 이동').disabled).toBe(false);
  expect(photo().src).toBe(signed);
  await act(() => photo().dispatchEvent(new Event('error')));
  expect(photo().src).toBe(original);
  await act(() => photo().dispatchEvent(new Event('error')));
  expect(photo().src).toContain('unavailable-image');
  expect(showToast).not.toHaveBeenCalled();
});

it.each(['original works', 'both fail', 'mirror failed', 'chosen template'] as const)(
  'only reports a default image after a saved edit when %s',
  async (scenario) => {
    const api = createPreviewApi('normal');
    const hasPhoto = scenario === 'original works' || scenario === 'both fail';
    vi.spyOn(api, 'update').mockResolvedValueOnce(
      done({
        ...sampleProduct,
        productTitle: '수정한 제목',
        imageFileUrl: hasPhoto ? 'https://storage.example/signed.webp' : null,
        imageUrl: hasPhoto ? 'https://shop.example/original.jpg' : null,
        imageStatus: scenario === 'mirror failed' ? 'FAILED' : hasPhoto ? 'READY' : 'NONE',
      }),
    );
    const { container } = await edit(api);
    await input(container, '상품명', '수정한 제목');
    await click(container, '수정 완료');
    const fallbackMessage = '대표 이미지를 불러올 수 없어 기본 이미지로 대체했어요.';
    const photo = () => container.querySelector<HTMLImageElement>('figure img')!;
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('main h2')?.textContent).toBe('수정한 제목');
    if (hasPhoto) {
      await act(() => photo().dispatchEvent(new Event('error')));
      expect(photo().src).toContain('original.jpg');
      expect(showToast).not.toHaveBeenCalledWith(fallbackMessage, expect.anything());
    }
    if (scenario === 'both fail') await act(() => photo().dispatchEvent(new Event('error')));
    if (scenario === 'chosen template') {
      expect(photo().src).toContain('tops.png');
      expect(showToast).not.toHaveBeenCalledWith(fallbackMessage, expect.anything());
    }
    if (scenario === 'both fail' || scenario === 'mirror failed') {
      expect(photo().alt).toBe('기본 상품 이미지');
      await act(() => photo().dispatchEvent(new Event('error')));
      expect(
        vi.mocked(showToast).mock.calls.filter(([msg]) => msg === fallbackMessage),
      ).toHaveLength(1);
    }
    expect(showToast).toHaveBeenCalledWith('상품 정보 수정을 완료했어요', { compact: true });
  },
);
it('tries the same image again after a confirmed edit without re-reading detail', async () => {
  const api = createPreviewApi('normal');
  const product = { ...sampleProduct, imageUrl: 'https://shop.example/temporary.jpg' };
  const get = vi.spyOn(api, 'get').mockResolvedValue(product);
  vi.spyOn(api, 'update').mockResolvedValueOnce(done({ ...product, productTitle: '새 상품명' }));
  const { container } = await mount(api);
  const image = () => container.querySelector<HTMLImageElement>('figure img')!;
  await act(() => image().dispatchEvent(new Event('error')));
  expect(image().alt).toBe('기본 상품 이미지');

  await click(container, '상품 관리');
  await click(container, '상품 수정');
  await click(container, '취소');
  expect(image().alt).toBe('기본 상품 이미지');
  await click(container, '상품 관리');
  await click(container, '상품 수정');
  await click(container, '수정 완료');
  expect(image().src).toBe(product.imageUrl);
  expect(image().alt).toBe('새 상품명');
  expect(showToast).toHaveBeenCalledExactlyOnceWith('상품 정보 수정을 완료했어요', {
    compact: true,
  });
  await act(() => image().dispatchEvent(new Event('error')));
  expect(image().alt).toBe('기본 상품 이미지');
  expect(showToast).toHaveBeenLastCalledWith(
    '대표 이미지를 불러올 수 없어 기본 이미지로 대체했어요.',
    { compact: true, after: { id: 1, message: '상품 정보 수정을 완료했어요' } },
  );
  expect(get).toHaveBeenCalledOnce();
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
  await click(container, '원본 쇼핑몰로 이동');
  expect(order).toEqual(['open', 'record']);
  expect(purchase).not.toHaveBeenCalled();
});
it.each(['opener', 'record'] as const)(
  'allows header Back and cancels the original visit during %s',
  async (phase) => {
    const api = createPreviewApi('normal');
    const pending = deferred<void>();
    const record = vi.spyOn(api, 'openOriginal').mockReturnValue(pending.promise);
    const back = vi.fn(() => root.render(null));
    const { container, root } = await mount(api, {
      onBack: back,
      openExternal: async () => {
        if (phase === 'opener') await pending.promise;
      },
    });
    await click(container, '원본 쇼핑몰로 이동');
    const signal = record.mock.calls[0]?.[1];
    if (phase === 'record') expect(signal?.aborted).toBe(false);
    await click(container, '뒤로 가기');
    expect(back).toHaveBeenCalledOnce();
    if (phase === 'record') expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve());
    expect(record).toHaveBeenCalledTimes(phase === 'record' ? 1 : 0);
  },
);

it('ignores duplicate header Back while leaving and permits retry after failure', async () => {
  const pending = deferred<void>();
  const api = createPreviewApi('normal');
  const record = vi.spyOn(api, 'openOriginal').mockReturnValue(pending.promise);
  const back = deferred<void>();
  const onBack = vi
    .fn(async () => {})
    .mockImplementationOnce(async () => {
      await back.promise;
      throw new Error('Navigation failed');
    });
  const { container } = await mount(api, { onBack });
  await click(container, '원본 쇼핑몰로 이동');
  await act(() => {
    const control = button(container, '뒤로 가기');
    control.click();
    control.click();
  });
  expect(onBack).toHaveBeenCalledOnce();
  // Navigation did not leave this screen; the original visit can still finish normally.
  await act(async () => pending.resolve());
  await click(container, '뒤로 가기');
  expect(onBack).toHaveBeenCalledOnce();
  await act(async () => back.resolve());
  expect(container.textContent).toContain('이전 화면으로 돌아가지 못했어요.');
  await click(container, '뒤로 가기');
  expect(onBack).toHaveBeenCalledTimes(2);
  expect(record).toHaveBeenCalledOnce();
});

it.each([
  [
    'the native opener times out',
    new BridgeError('RESULT_UNKNOWN'),
    null,
    '이미 열린 창이 있는지 확인',
    0,
  ],
  ['opening is rejected', new Error('blocked'), null, '원본 쇼핑몰을 열지 못했어요', 0],
  ['only the visit record fails', null, new Error('offline'), '쇼핑몰은 열었지만 방문 기록', 1],
] as const)(
  'reports the original visit failure when %s',
  async (_, openError, recordError, message, records) => {
    const api = createPreviewApi('normal');
    const record = vi.spyOn(api, 'openOriginal');
    if (recordError) record.mockRejectedValue(recordError);
    const { container } = await mount(api, {
      openExternal: async () => {
        if (openError) throw openError;
      },
    });
    await click(container, '원본 쇼핑몰로 이동');
    expect(container.textContent).toContain(message);
    expect(record).toHaveBeenCalledTimes(records);
  },
);

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
it.each(['auth-required', 'not-found', 'forbidden'] as const)(
  'handles a confirmed %s after opening the original shop without repeating the visit',
  async (code) => {
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get');
    const record = vi
      .spyOn(api, 'openOriginal')
      .mockRejectedValueOnce(new ProductDetailError(code));
    const onSignIn = vi.fn(async () => {});
    const { container, props } = await mount(api, { onSignIn });
    await click(container, '원본 쇼핑몰로 이동');
    expect(props.openExternal).toHaveBeenCalledExactlyOnceWith(sampleProduct.productUrl);
    expect(container.textContent).not.toContain('원본 쇼핑몰을 열지 못했어요');
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
    if (code === 'auth-required') {
      expect(container.textContent).toContain('로그인한 뒤 상품을 확인해 주세요.');
      expect(container.textContent).not.toContain(sampleProduct.productTitle);
      expect(container.textContent).not.toContain('원본 쇼핑몰로 이동');
      await click(container, '로그인 화면으로 이동');
      expect(onSignIn).toHaveBeenCalledOnce();
    } else if (code === 'not-found') {
      expect(container.textContent).toContain('상품을 찾을 수 없어요.');
      expect(container.textContent).not.toContain('휴지통');
      expect(container.querySelector('[aria-label="상품 관리"]')).toBeNull();
      expect(button(container, '다시 확인')).toBeDefined();
    } else {
      expect(container.textContent).toContain('쇼핑몰은 열었지만 방문 기록을 남길 권한이 없어요.');
      expect(container.textContent).toContain(sampleProduct.productTitle);
    }
    expect(get).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledExactlyOnceWith('1', expect.any(AbortSignal));
  },
);

it('edits existing values and refreshes detail without creating another card', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  const title = '가'.repeat(199) + '🍑';
  await input(container, '상품명', title + '끝');
  expect(button(container, '수정 완료').disabled).toBe(true);
  await input(container, '상품명', title);
  await input(container, '가격', '0');
  for (const tag of sampleProduct.tags) await click(container, tag);
  await click(container, '봄');
  await click(container, '+직접 추가');
  await input(container, '새 해시태그', '#봄');
  expect(button(container, '태그 추가').disabled).toBe(true);
  await input(container, '새 해시태그', '#데이트');
  await click(container, '태그 추가');
  expect(document.activeElement).toBe(button(container, '+직접 추가'));
  expect(update).not.toHaveBeenCalled();
  expect(container.querySelector('details')?.open).toBe(false);
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      productTitle: title,
      price: 0,
      tags: ['봄', '데이트'],
      boardIds: ['1', '2'],
      imageFileId: sampleProduct.imageFileId,
      imageUrl: sampleProduct.imageUrl,
      fallbackIcon: sampleProduct.fallbackIcon,
    }),
  );
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
  expect(container.textContent).toContain(title);
});
it('shows the won amount on blur but sends a numeric price even when pasted with its unit', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  const label = [...container.querySelectorAll('label')].find(
    (item) => item.textContent === '가격',
  )!;
  const price = container.querySelector<HTMLInputElement>('#' + CSS.escape(label.htmlFor))!;
  expect(price.value).toBe('39,000원');
  await act(() => price.focus());
  expect(price.value).toBe('39000');
  await act(() => price.blur());
  await click(container, '가격 지우기');
  expect(price.value).toBe('');
  expect(container.ownerDocument.activeElement).toBe(price);
  await input(container, '가격', '1,2원');
  await act(() => price.blur());
  expect(price.value).toBe('1,2원');
  expect(button(container, '수정 완료').disabled).toBe(true);
  await act(() => price.focus());
  await input(container, '가격', ' 45,900원 ');
  await act(() => price.blur());
  expect(price.value).toBe('45,900원');
  await act(() => price.focus());
  expect(price.value).toBe('45900');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith('1', expect.objectContaining({ price: 45_900 }));
});

it('enforces the deployed price and tag rules before submitting', async () => {
  const { container } = await edit();
  for (const price of ['', '1e3', '1,000,000,001']) {
    await input(container, '가격', price);
    expect(button(container, '수정 완료').disabled).toBe(true);
  }
  await input(container, '가격', '1,000,000,000');
  for (const tag of sampleProduct.tags) await click(container, tag);
  expect(button(container, '수정 완료').disabled).toBe(true);
  await click(container, '+직접 추가');
  await input(container, '새 해시태그', '일이삼사오육칠');
  expect(button(container, '태그 추가').disabled).toBe(true);
  await input(container, '새 해시태그', '일이삼사오육');
  await click(container, '태그 추가');
  expect(button(container, '수정 완료').disabled).toBe(false);
});
it('accepts the server code-point limits for emoji in memo and tags', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  const memo = '🍑'.repeat(100);
  await input(container, '한 줄 메모(선택)', memo + '끝');
  expect(button(container, '수정 완료').disabled).toBe(true);
  expect(container.textContent).toContain('한 줄 메모는 100자까지 저장할 수 있어요.');
  await input(container, '한 줄 메모(선택)', ` ${memo} `);
  expect(button(container, '수정 완료').disabled).toBe(false);

  await click(container, '+직접 추가');
  const tag = '💚'.repeat(6);
  await input(container, '새 해시태그', tag + '끝');
  expect(button(container, '태그 추가').disabled).toBe(true);
  await input(container, '새 해시태그', tag);
  await click(container, '태그 추가');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      memo,
      tags: [...sampleProduct.tags, tag],
    }),
  );
});

it('matches the backend tag normalization and blocks invisible characters before PATCH', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await click(container, '가을');
  await click(container, '+직접 추가');
  await input(container, '새 해시태그', `# # ${'가을'.normalize('NFD')}`);
  expect(button(container, '태그 추가').disabled).toBe(true);
  await input(container, '새 해시태그', '여\u200B행');
  expect(button(container, '태그 추가').disabled).toBe(true);
  expect(container.querySelector('[aria-label="새 해시태그"]')?.getAttribute('aria-invalid')).toBe(
    'true',
  );
  expect(container.textContent).toContain('보이지 않는 문자는 사용할 수 없어요');
  expect(update).not.toHaveBeenCalled();
  await input(container, '새 해시태그', ` # # ${'여행'.normalize('NFD')}　　코디 `);
  await click(container, '태그 추가');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      tags: [...sampleProduct.tags, '가을', '여행 코디'],
    }),
  );
});

it('keeps unselected custom tags available and allows reselecting them', async () => {
  const { container } = await edit();
  const existingTag = sampleProduct.tags[0]!;
  await click(container, existingTag);
  expect(button(container, existingTag).getAttribute('aria-pressed')).toBe('false');
  await click(container, existingTag);
  expect(button(container, existingTag).getAttribute('aria-pressed')).toBe('true');
});

it('puts board retry in the fixed actions and keeps the draft without reading detail again', async () => {
  const api = createPreviewApi('normal');
  const list = vi.spyOn(api, 'listBoards').mockRejectedValueOnce(new Error('offline'));
  const get = vi.spyOn(api, 'get');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '상품명', '보존할 제목');
  const retry = button(container, '보드 목록 다시 불러오기');
  expect(retry.closest('dialog')).not.toBeNull();
  expect(retry.closest('form')).toBeNull();
  expect(container.textContent).toContain('보드 목록을 불러오지 못했어요. 입력은 유지돼요.');
  expect(container.textContent).not.toContain('수정 완료');
  await click(container, '보드 목록 다시 불러오기');
  expect(button(container, '수정 완료').disabled).toBe(false);
  expect(container.querySelector<HTMLInputElement>('dialog input')?.value).toBe('보존할 제목');
  expect(list).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
});

it('keeps the edited title and asks for a new board if the server rejects a stale selection', async () => {
  const api = createPreviewApi('normal');
  const get = vi.spyOn(api, 'get');
  const boards = deferred<typeof sampleProduct.boards>();
  vi.spyOn(api, 'listBoards')
    .mockResolvedValueOnce(sampleProduct.boards)
    .mockReturnValueOnce(
      boards.promise.then(() => {
        throw new ApiError(503);
      }),
    )
    .mockResolvedValueOnce([sampleProduct.boards[0]!]);
  const update = vi.spyOn(api, 'update').mockResolvedValueOnce(rejected('board-not-found'));
  const { container } = await edit(api);
  await input(container, '상품명', '보존할 이름');
  await click(container, '기본 보드');
  await click(container, '수정 완료');
  expect(button(container, '수정 완료').disabled).toBe(true);
  expect(container.querySelector('[aria-label="보드 선택"]')).not.toBeNull();
  expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain(
    '선택한 보드가 바뀌었어요',
  );
  await act(async () => boards.resolve([]));
  expect(container.textContent).toContain('보드 목록을 불러오지 못했어요. 입력은 유지돼요.');
  expect(update).toHaveBeenCalledOnce();
  await click(container, '보드 목록 다시 불러오기');
  expect(button(container, '수정 완료').disabled).toBe(true);
  await click(container, '기본 보드');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenLastCalledWith(
    '1',
    expect.objectContaining({
      productTitle: '보존할 이름',
      boardIds: ['1'],
    }),
  );
  expect(get).toHaveBeenCalledOnce();
});

it('keeps the stored image when a draft switches back from an optional replacement', async () => {
  const api = createPreviewApi('normal');
  const imageUrl = 'https://shop.example/original.png';
  vi.spyOn(api, 'get').mockResolvedValueOnce({ ...sampleProduct, imageUrl, imageFileId: '81' });
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  const options = container.querySelector('details')!;
  expect(options.open).toBe(false);
  await act(() => {
    options.open = true;
  });
  await click(options, '바지');
  await click(options, '기존 이미지 유지');
  expect(button(options, '기존 이미지 유지').getAttribute('aria-pressed')).toBe('true');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      imageUrl,
      imageFileId: '81',
      fallbackIcon: sampleProduct.fallbackIcon,
    }),
  );
});

it('requires an explicit replacement image without losing edits when the existing image is rejected', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update').mockResolvedValueOnce(rejected('image-unusable'));
  const { container } = await edit(api);
  await input(container, '상품명', '도안 교체 후 저장할 이름');
  await click(container, '수정 완료');
  expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain(
    '새 도안을 선택해 주세요',
  );
  expect(container.querySelector('details')?.open).toBe(true);
  expect(button(container, '수정 완료').disabled).toBe(true);
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledOnce();
  const choices = container.querySelector<HTMLElement>('[role="group"][aria-label="카드 이미지"]')!;
  expect(choices.textContent).not.toContain('기존 이미지 유지');
  await click(choices, '바지');
  expect(button(choices, '바지').getAttribute('aria-pressed')).toBe('true');
  expect(button(container, '수정 완료').disabled).toBe(false);
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenLastCalledWith(
    '1',
    expect.objectContaining({
      productTitle: '도안 교체 후 저장할 이름',
      fallbackIcon: 'PANTS',
      imageFileId: null,
      imageUrl: null,
    }),
  );
});

it('preserves stored non-breaking spaces in unedited text when changing the price', async () => {
  const api = createPreviewApi('normal');
  const productTitle = '\u00a0오버핏 니트\u202f';
  const memo = '\u2007선물용 메모\u00a0';
  vi.spyOn(api, 'get').mockResolvedValueOnce({ ...sampleProduct, productTitle, memo });
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '가격', '45000');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({ price: 45000, productTitle, memo }),
  );
});

it('counts the memo after Java whitespace trimming without ignoring non-breaking spaces', async () => {
  const api = createPreviewApi('normal');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  const memo = '\u00a0' + '🍑'.repeat(99);
  await input(container, '한 줄 메모(선택)', `\u3000${memo}\u202f`);
  expect(button(container, '수정 완료').disabled).toBe(true);
  expect(container.textContent).toContain('한 줄 메모는 100자까지 저장할 수 있어요.');
  await input(container, '한 줄 메모(선택)', `\u3000${memo}\u2003`);
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith('1', expect.objectContaining({ memo }));
});

it('requires at least one active board', async () => {
  const { container } = await edit();
  await click(container, '기본 보드');
  await click(container, '가을 코디');
  expect(button(container, '수정 완료').disabled).toBe(true);
});
it('blocks duplicate updates and the header back button until a write settles', async () => {
  const api = createPreviewApi('normal');
  const pending = deferred<{ status: 'done'; value: typeof sampleProduct }>();
  const update = vi.spyOn(api, 'update').mockReturnValue(pending.promise);
  const { container } = await edit(api);
  await act(() => {
    button(container, '수정 완료').click();
    button(container, '수정 완료').click();
  });
  await click(container, '뒤로 가기');
  expect(container.querySelector('dialog h2')?.textContent).toBe('상품 수정');
  expect(update).toHaveBeenCalledOnce();
  await act(async () => pending.resolve({ status: 'done', value: sampleProduct }));
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
  expect(container.textContent).not.toContain('수정 완료');
  expect(get).toHaveBeenCalledOnce();
  await click(container, '상세에서 확인');
  expect(container.querySelector('h1')?.textContent).toBe('상품 상세');
  expect(get).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenCalledOnce();
});
it('keeps the edit locked and preserves the draft when the status read also fails', async () => {
  const api = createPreviewApi('unknown');
  const get = vi.spyOn(api, 'get');
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '상품명', '유지할 이름');
  await click(container, '수정 완료');
  get.mockRejectedValueOnce(new Error('offline'));
  const dialog = container.querySelector('dialog')!;
  expect(document.activeElement).toBe(button(dialog, '현재 상태 확인'));
  await click(dialog, '현재 상태 확인');
  expect(document.activeElement).toBe(button(dialog, '현재 상태 확인'));
  expect(dialog.textContent).toContain('입력은 유지돼요');
  expect(dialog.querySelector<HTMLInputElement>('input')?.value).toBe('유지할 이름');
  expect(dialog.textContent).not.toContain('수정 완료');
  await click(dialog, '현재 상태 확인');
  const save = button(dialog, '수정 완료');
  expect(save.disabled).toBe(false);
  expect(document.activeElement).toBe(save);
  const heldEnter = new KeyboardEvent('keydown', {
    key: 'Enter',
    repeat: true,
    bubbles: true,
    cancelable: true,
  });
  await act(() => save.dispatchEvent(heldEnter));
  expect(heldEnter.defaultPrevented).toBe(true);
  expect(update).toHaveBeenCalledOnce();
});

it.each(['pointer', 'moved focus'] as const)(
  'does not move focus to a recovery action after %s',
  async (activation) => {
    const api = createPreviewApi('normal');
    const response = deferred<typeof unknownOutcome>();
    vi.spyOn(api, 'update').mockReturnValueOnce(response.promise);
    const { container } = await edit(api);
    const close = button(container, '닫기');
    close.focus();
    await act(() => {
      button(container, '수정 완료').dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          detail: activation === 'pointer' ? 1 : 0,
        }),
      );
    });
    if (activation === 'moved focus') close.focus();
    await act(async () => response.resolve(unknownOutcome));
    expect(button(container, '현재 상태 확인')).toBeDefined();
    expect(document.activeElement).toBe(close);
  },
);

it.each(['unchanged', 'applied', 'conflict'] as const)(
  'reconciles %s server data without replaying PATCH',
  async (server) => {
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get');
    const update = vi.spyOn(api, 'update').mockResolvedValueOnce(unknownOutcome);
    const { container } = await edit(api);
    const draft = server === 'applied' ? '유지할    초안' : '유지할 초안';
    await input(container, '상품명', draft);
    await click(container, '수정 완료');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      '1',
      expect.objectContaining({ productTitle: '유지할 초안' }),
    );
    get.mockResolvedValueOnce({
      ...sampleProduct,
      productTitle:
        server === 'applied'
          ? '유지할 초안'
          : server === 'conflict'
            ? '다른 기기의 변경'
            : sampleProduct.productTitle,
      boards: [...sampleProduct.boards].reverse(),
    });
    await click(container.querySelector('dialog')!, '현재 상태 확인');
    expect(get).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
    if (server === 'unchanged') {
      expect(container.querySelector<HTMLInputElement>('dialog input')?.value).toBe('유지할 초안');
      expect(button(container, '수정 완료').disabled).toBe(false);
      await click(container, '수정 완료');
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenLastCalledWith(
        '1',
        expect.objectContaining({ productTitle: '유지할 초안' }),
      );
    } else if (server === 'conflict') {
      expect(container.querySelector<HTMLInputElement>('dialog input')?.value).toBe('유지할 초안');
      expect(container.textContent).not.toContain('수정 완료');
      expect(document.activeElement?.getAttribute('role')).toBe('alert');
      await click(container, '최신 상세 보기');
      expect(container.querySelector('main h2')?.textContent).toBe('다른 기기의 변경');
      expect(get).toHaveBeenCalledTimes(2);
    } else {
      expect(container.querySelector('dialog')).toBeNull();
      expect(container.querySelector('main h2')?.textContent).toBe('유지할 초안');
      expect(button(container, '상품 관리').disabled).toBe(false);
    }
  },
);

it.each(['applied', 'unchanged', 'different-original', 'manual-file'] as const)(
  'reconciles a new image file with %s data after a lost PATCH reply',
  async (scenario) => {
    const before = {
      ...sampleProduct,
      imageUrl: 'https://example.com/original.png',
      imageStatus: 'PENDING' as const,
    };
    const latest = {
      ...before,
      imageUrl: scenario === 'different-original' ? 'https://example.com/new.png' : before.imageUrl,
      imageStatus: scenario === 'manual-file' ? ('NONE' as const) : ('READY' as const),
      imageFileId: '81',
      imageFileUrl: 'https://example.com/signed.png',
      productTitle: scenario === 'unchanged' ? before.productTitle : '수정한 제목',
    };
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce(before).mockResolvedValueOnce(latest);
    const update = vi.spyOn(api, 'update').mockResolvedValueOnce(unknownOutcome);
    const { container } = await edit(api);
    await input(container, '상품명', '수정한 제목');
    await click(container, '수정 완료');
    await click(container.querySelector('dialog')!, '현재 상태 확인');
    expect(get).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledExactlyOnceWith(
      '1',
      expect.objectContaining({ imageFileId: null }),
    );

    if (scenario === 'applied') {
      expect(container.querySelector('dialog')).toBeNull();
      expect(container.querySelector('main h2')?.textContent).toBe('수정한 제목');
      expect(container.querySelector('main img')?.getAttribute('src')).toBe(latest.imageFileUrl);
    } else if (scenario === 'unchanged') {
      const dialog = container.querySelector('dialog')!;
      expect(dialog.querySelector('input')?.value).toBe('수정한 제목');
      await click(dialog, '수정 완료');
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenLastCalledWith('1', expect.objectContaining({ imageFileId: '81' }));
    } else {
      expect(container.textContent).not.toContain('수정 완료');
      expect(container.textContent).toContain('최신 상세 보기');
    }
  },
);

it.each([
  'save',
  'status check',
  'boards',
  'boards after rejection',
  'boards after status check',
] as const)(
  'keeps the draft and stops requests when the session expires during %s',
  async (step) => {
    const api = createPreviewApi('normal');
    const auth = new ProductDetailError('auth-required');
    const get = vi.spyOn(api, 'get');
    const listBoards = vi.spyOn(api, 'listBoards');
    const update = vi
      .spyOn(api, 'update')
      .mockResolvedValue(
        step.endsWith('status check')
          ? unknownOutcome
          : rejected(step === 'boards after rejection' ? 'board-not-found' : 'auth-required'),
      );
    const refreshBoards = step.startsWith('boards after');
    if (step === 'boards') listBoards.mockRejectedValueOnce(auth);
    if (refreshBoards) {
      listBoards.mockResolvedValueOnce(sampleProduct.boards).mockRejectedValueOnce(auth);
    }
    const login = deferred<void>();
    const onSignIn = vi.fn(async () => {
      await login.promise;
      throw new Error('navigation failed');
    });
    const { container } = await edit(api, { onSignIn });
    if (step !== 'boards') await input(container, '상품명', '저장할 초안');
    const dialog = container.querySelector('dialog')!;
    if (step !== 'boards') await click(dialog, '수정 완료');
    if (step.endsWith('status check')) {
      if (!refreshBoards) get.mockRejectedValueOnce(auth);
      await click(dialog, '현재 상태 확인');
    }
    const field = dialog.querySelector('input')!;
    expect(field.value).toBe(step === 'boards' ? sampleProduct.productTitle : '저장할 초안');
    expect(field.closest('fieldset')?.disabled).toBe(true);
    expect(dialog.textContent).toContain('로그인이 만료됐어요');
    expect(dialog.textContent).not.toMatch(/선택한 보드가 바뀌었어요|조회한 정보에 수정 내용이/);
    expect(dialog.textContent).not.toMatch(/수정 완료|현재 상태 확인|보드 목록 다시 불러오기/);
    const signIn = button(dialog, '로그인 화면으로 이동');
    await act(() => {
      signIn.click();
      signIn.click();
    });
    expect(signIn.disabled).toBe(true);
    expect(onSignIn).toHaveBeenCalledOnce();
    await act(async () => login.resolve());
    expect(dialog.textContent).toContain('로그인 화면을 열지 못했어요');
    expect(signIn.disabled).toBe(false);
    await click(dialog, '상세에서 확인');
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.textContent).toContain('로그인한 뒤 상품을 확인해 주세요.');
    expect(container.textContent).not.toContain(sampleProduct.productTitle);
    expect(container.textContent).not.toContain('원본 쇼핑몰로 이동');
    expect(button(container, '로그인 화면으로 이동')).toBeDefined();
    expect(update).toHaveBeenCalledTimes(step === 'boards' ? 0 : 1);
    expect(get).toHaveBeenCalledTimes(step.endsWith('status check') ? 2 : 1);
    expect(listBoards).toHaveBeenCalledTimes(refreshBoards ? 2 : 1);
  },
);

it.each(['initial list', 'stale selection', 'checked update'] as const)(
  'locks edit on denied board choices without denying detail (%s)',
  async (step) => {
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get');
    const onSignIn = vi.fn();
    const choices = vi.spyOn(api, 'listBoards');
    if (step !== 'initial list') choices.mockResolvedValueOnce(sampleProduct.boards);
    choices.mockRejectedValueOnce(new ProductDetailError('forbidden'));
    const update = vi
      .spyOn(api, 'update')
      .mockResolvedValue(step === 'checked update' ? unknownOutcome : rejected('board-not-found'));
    const { container } = await edit(api, { onSignIn });
    const dialog = container.querySelector('dialog')!;
    if (step !== 'initial list') {
      await input(dialog, '상품명', '보존할 초안');
      await click(dialog, '수정 완료');
    }
    if (step === 'checked update') await click(dialog, '현재 상태 확인');
    const draft = dialog.querySelector('input')!;
    expect(draft.value).toBe(step === 'initial list' ? sampleProduct.productTitle : '보존할 초안');
    expect(draft.readOnly).toBe(true);
    expect(draft.closest('fieldset')?.disabled).toBe(true);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(
      '보드 목록을 볼 수 있는 권한이 없어요.',
    );
    expect(dialog.textContent).not.toMatch(
      /선택한 보드가 바뀌었어요|조회한 정보에 수정 내용이|수정 완료|현재 상태 확인|보드 목록 다시 불러오기|로그인 화면으로 이동/,
    );
    await click(dialog, '취소');
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('main h2')?.textContent).toBe(sampleProduct.productTitle);
    expect(button(container, '원본 쇼핑몰로 이동').disabled).toBe(false);
    expect(get).toHaveBeenCalledTimes(step === 'checked update' ? 2 : 1);
    expect(choices).toHaveBeenCalledTimes(step === 'initial list' ? 1 : 2);
    expect(update).toHaveBeenCalledTimes(step === 'initial list' ? 0 : 1);
    expect(onSignIn).not.toHaveBeenCalled();
  },
);

it('shows the missing product without a second detail read after PATCH returns product 404', async () => {
  const api = createPreviewApi('normal');
  const get = vi.spyOn(api, 'get');
  const update = vi.spyOn(api, 'update').mockResolvedValueOnce(rejected('not-found'));
  const { container } = await edit(api, {});
  const dialog = container.querySelector('dialog')!;
  await input(dialog, '상품명', '유지할 초안');
  await click(dialog, '수정 완료');
  expect(dialog.querySelector('input')?.value).toBe('유지할 초안');
  expect(dialog.querySelector('fieldset')?.disabled).toBe(true);
  expect(dialog.textContent).not.toMatch(/수정 완료|현재 상태 확인/);
  await click(dialog, '상세에서 확인');
  expect(container.textContent).toContain('상품을 찾을 수 없어요.');
  expect(container.textContent).not.toMatch(/휴지통|원본 쇼핑몰로 이동/);
  expect(button(container, '다시 확인')).toBeDefined();
  expect(get).toHaveBeenCalledOnce();
  expect(update).toHaveBeenCalledOnce();
});

it.each(['not-found', 'forbidden'] as const)(
  'does not read detail twice after a status check confirms %s',
  async (code) => {
    const api = createPreviewApi('normal');
    const get = vi.spyOn(api, 'get');
    const update = vi.spyOn(api, 'update').mockResolvedValueOnce(unknownOutcome);
    const { container } = await edit(api, {});
    await input(container, '상품명', '남아 있는 초안');
    const dialog = container.querySelector('dialog')!;
    await click(dialog, '수정 완료');
    get.mockRejectedValueOnce(new ProductDetailError(code));
    await click(dialog, '현재 상태 확인');
    expect(dialog.querySelector('input')?.value).toBe('남아 있는 초안');
    expect(dialog.textContent).not.toMatch(/수정 완료|현재 상태 확인/);
    await click(dialog, '상세에서 확인');
    expect(container.textContent).not.toContain(sampleProduct.productTitle);
    expect(container.querySelector('button[aria-label="상품 관리"]')).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
    if (code === 'not-found') {
      expect(container.textContent).toContain('상품을 찾을 수 없어요.');
      expect(container.textContent).not.toContain('휴지통');
      expect(button(container, '다시 확인')).toBeDefined();
    } else {
      expect(container.textContent).toContain('이 상품을 볼 수 있는 권한이 없어요.');
      await click(container, '다시 확인');
      expect(get).toHaveBeenCalledTimes(3);
      expect(update).toHaveBeenCalledOnce();
    }
  },
);

it.each([false, true])(
  'keeps the draft and returns focus after board creation unless the user moved it (%s)',
  async (moved) => {
    const api = createPreviewApi('normal');
    const release = deferred<void>();
    const createBoard = api.createBoard;
    const create = vi.spyOn(api, 'createBoard').mockImplementation(async (name) => {
      await release.promise;
      return createBoard(name);
    });
    const update = vi.spyOn(api, 'update');
    const { container } = await edit(api);
    await input(container, '상품명', '보존할 제목');
    await click(container, '새 보드 만들기');
    await input(container, '새 보드 이름', '\u200b가을 코디\u00a0');
    expect(button(container, '완료').disabled).toBe(true);
    const name = '🧥'.repeat(10);
    await input(container, '새 보드 이름', name + '끝');
    expect(button(container, '완료').disabled).toBe(true);
    expect(container.textContent).toContain('11/10');
    await input(container, '새 보드 이름', `\u200b${name}\u3000`);
    expect(container.textContent).toContain('10/10');
    await click(container, '완료');
    const title = container.querySelector<HTMLInputElement>('dialog input')!;
    if (moved) title.focus();
    await act(async () => release.resolve());
    expect(document.activeElement).toBe(moved ? title : button(container, '새 보드 만들기'));
    expect(create).toHaveBeenCalledExactlyOnceWith(name);
    expect(update).not.toHaveBeenCalled();
    const created = [...container.querySelectorAll('label')].find(
      (label) => label.textContent === name,
    );
    expect(created?.querySelector('input')?.checked).toBe(true);
    await click(container, '수정 완료');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      '1',
      expect.objectContaining({
        productTitle: '보존할 제목',
        boardIds: ['1', '2', '3'],
      }),
    );
    expect(container.textContent).not.toMatch(/복구|휴지통/);
  },
);

it.each([
  ['+직접 추가', '새 해시태그'],
  ['새 보드 만들기', '새 보드 이름'],
])('returns focus to %s when closing its inline entry with Escape', async (trigger, label) => {
  const { container } = await edit();
  await click(container, trigger);
  const draft = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  expect(document.activeElement).toBe(draft);
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(() => draft.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(true);
  expect(container.querySelector('dialog')).not.toBeNull();
  expect(document.activeElement).toBe(button(container, trigger));
});

it('keeps a confirmed board name conflict through a failed refresh without replaying the POST', async () => {
  const api = createPreviewApi('normal');
  const createBoard = api.createBoard;
  const list = vi.spyOn(api, 'listBoards');
  const create = vi.spyOn(api, 'createBoard').mockImplementationOnce(async (name) => {
    await createBoard(name);
    list.mockRejectedValueOnce(new ApiError(503));
    throw new ApiError(409, 'DUPLICATE_BOARD_NAME');
  });
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '상품명', '보존할 제목');
  await click(container, '새 보드 만들기');
  await input(container, '새 보드 이름', '공유 보드');
  await click(container, '완료');
  expect(container.textContent).toContain('이미 있는 보드예요. 목록에서 선택해 주세요.');
  expect(container.textContent).not.toContain('보드 생성 결과를 확인하지 못했어요.');
  expect(button(container, '완료').disabled).toBe(true);
  expect(update).not.toHaveBeenCalled();
  await click(container, '보드 목록 다시 불러오기');
  expect(list).toHaveBeenCalledTimes(3);
  const existing = [...container.querySelectorAll('label')].find(
    (label) => label.textContent === '공유 보드',
  );
  expect(existing?.querySelector('input')?.checked).toBe(false);
  await click(container, '공유 보드');
  expect(container.querySelector('input[aria-label="새 보드 이름"]')).toBeNull();
  await click(container, '수정 완료');
  expect(create).toHaveBeenCalledExactlyOnceWith('공유 보드');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({ productTitle: '보존할 제목', boardIds: ['1', '2', '3'] }),
  );
});

it.each([
  ['failed', '사용할 수 있는 문자로 10자 이하의 이름을 입력해 주세요.'],
  ['forbidden', '새 보드를 만들 수 있는 권한이 없어요.'],
] as const)(
  'shows confirmed board creation error %s without reloading choices',
  async (code, message) => {
    const api = createPreviewApi('normal');
    const list = vi.spyOn(api, 'listBoards');
    const create = vi.spyOn(api, 'createBoard').mockRejectedValueOnce(new ProductDetailError(code));
    const { container } = await edit(api);
    await click(container, '새 보드 만들기');
    await input(container, '새 보드 이름', '테스트 이름');
    await click(container, '완료');
    expect(container.textContent).toContain(message);
    expect(container.textContent).not.toContain('보드 생성 결과를 확인하지 못했어요.');
    expect(button(container, '완료').disabled).toBe(true);
    expect(list).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  },
);

it('reloads choices without repeating board creation when its reply is lost', async () => {
  const api = createPreviewApi('normal');
  const createBoard = api.createBoard;
  const create = vi.spyOn(api, 'createBoard').mockImplementationOnce(async (name) => {
    await createBoard(name);
    throw new Error('lost reply');
  });
  const update = vi.spyOn(api, 'update');
  const { container } = await edit(api);
  await input(container, '상품명', '보존할 제목');
  await click(container, '새 보드 만들기');
  await input(container, '새 보드 이름', '공유 보드');
  await click(container, '완료');
  expect(container.textContent).toContain('이미 있는 보드예요. 목록에서 선택해 주세요.');
  expect(button(container, '완료').disabled).toBe(true);
  const created = [...container.querySelectorAll('label')].find(
    (label) => label.textContent === '공유 보드',
  );
  expect(created?.querySelector('input')?.checked).toBe(false);
  expect(create).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
  const actions = button(container, '완료').parentElement!;
  await click(actions, '취소');
  await click(container, '공유 보드');
  await click(container, '수정 완료');
  expect(update).toHaveBeenCalledExactlyOnceWith(
    '1',
    expect.objectContaining({
      productTitle: '보존할 제목',
      boardIds: ['1', '2', '3'],
    }),
  );
});
