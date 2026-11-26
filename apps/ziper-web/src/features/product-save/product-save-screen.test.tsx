// @vitest-environment happy-dom
import { startSession } from '@ziper/api/http';
import { parseWholeWon } from '@ziper/api/product-fields';
import type { RuntimeStatus } from '@ziper/bridge/contract';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { server } from '../../test/server';
import { createTestQueryClient, withQuery } from '../../test/query';
import { ConnectedProductSave } from './connected-product-save';
import type { ProductPreview } from './product-lookup';
import { ProductSaveScreen } from './product-save-screen';

const bridge = vi.hoisted(() => ({ status: 'initializing' as RuntimeStatus, platform: {} }));
vi.mock('../../bridge/provider', () => ({ usePlatform: () => bridge }));

const url = 'https://www.musinsa.com/products/7';
const extractedProduct = { name: '니트', price: 35_690, imageURL: 'https://cdn.example/pdp.jpg' };
const shops = [
  {
    shop: 'MUSINSA',
    hosts: ['www.musinsa.com'],
    imageHosts: ['cdn.example'],
    imageStrategy: 'SERVER_MIRROR',
    fields: { title: ['ldjson:name'], price: ['ldjson:price'], image: ['ldjson:image'] },
  },
];
const board = (boardId: number, name: string) => ({
  boardId,
  name,
  modifiable: true,
  productCount: 0,
  previewImages: [],
  createdAt: '2026-11-22T00:00:00Z',
});
const boardList = (...boards: ReturnType<typeof board>[]) =>
  HttpResponse.json({ boards, purchasedSummary: { productCount: 0, previewImages: [] } });

const container = document.createElement('div');
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
let root: ReturnType<typeof createRoot> | undefined;

type Reply = () => Response | Promise<Response>;
function mockApi({
  check = () =>
    HttpResponse.json({ canonicalUrl: url, shop: null, supported: true, existingCardId: null }),
  boards = [() => boardList(board(1, '기본 보드'))],
  save = () => HttpResponse.json({ cardId: 1 }, { status: 201 }),
}: { check?: Reply; boards?: Reply[]; save?: Reply } = {}) {
  const calls = { checks: 0, boards: 0, saves: [] as unknown[] };
  server.use(
    http.get('*/api/v1/products/extraction-rules', () => HttpResponse.json({ shops })),
    http.post('*/api/v1/products/url-check', () => {
      calls.checks++;
      return check();
    }),
    http.get('*/api/v1/boards', () => (boards[calls.boards++] ?? boards.at(-1)!)()),
    http.post('*/api/v1/products', async ({ request }) => {
      calls.saves.push(await request.json());
      return save();
    }),
  );
  return calls;
}

async function mount(product?: ProductPreview) {
  const extract = product ? vi.fn().mockResolvedValue({ url, ...product }) : null;
  root = createRoot(container);
  await act(() =>
    root!.render(
      withQuery(
        <ProductSaveScreen
          url={url}
          extract={extract}
          onClose={() => {}}
          initialDraft={{ name: '니트', memo: '', image: null, tags: [], boardIds: [] }}
        />,
      ),
    ),
  );
  await settle();
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  startSession('token');
});
afterEach(async () => {
  await act(() => root?.unmount());
  startSession(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === label,
  )!;
const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const sendForm = () =>
  act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
const linkedPreview = () => container.querySelector(`img[src="${extractedProduct.imageURL}"]`)!;
const priceInput = () => container.querySelector<HTMLInputElement>('input[inputmode=numeric]')!;
const firstBoard = () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!;

it.each(['ready', 'pending'])('does not start a manual lookup on pagehide: %s', async (phase) => {
  let pendingOnce = phase === 'pending';
  const calls = mockApi({
    boards: [() => boardList()],
    check: () => {
      if (pendingOnce) {
        pendingOnce = false;
        return new Promise(() => {});
      }
      return HttpResponse.json({
        canonicalUrl: url,
        shop: null,
        supported: true,
        existingCardId: null,
      });
    },
  });
  root = createRoot(container);
  const client = createTestQueryClient();
  const show = async (status: RuntimeStatus) => {
    bridge.status = status;
    await act(() =>
      root!.render(withQuery(<ConnectedProductSave url={url} onClose={() => {}} />, client)),
    );
    await settle();
  };
  await show('web');
  const price = priceInput();
  if (phase === 'ready') await type(price, '36000');
  await show('closed');
  await show('initializing');
  expect(calls.checks).toBe(1);
  await show('web');
  expect(calls.checks).toBe(phase === 'pending' ? 2 : 1);
  if (phase === 'ready') {
    expect(priceInput()).toBe(price);
    expect(price.value).toBe('36000');
  }
});

it('accepts whole won amounts without turning malformed input into a different price', () => {
  expect(
    ['0', ' 45,900 ', '1e3', '1,2', '-50', '1,000,000,000', '1000000001'].map(parseWholeWon),
  ).toEqual([0, 45900, null, null, null, 1_000_000_000, null]);
});

it('normalizes title and tag limits when saving a new product', async () => {
  const calls = mockApi();
  await mount(extractedProduct);
  await act(() => button('+직접 추가').click());
  const tag = container.querySelector<HTMLInputElement>('input[aria-label="새 해시태그"]')!;
  await type(tag, '가​을');
  expect(button('추가').disabled).toBe(true);
  expect(tag.getAttribute('aria-invalid')).toBe('true');
  await type(tag, `# ${'봄'.normalize('NFD')}`);
  expect(button('추가').disabled).toBe(true);
  await type(tag, '💚'.repeat(7));
  expect(button('추가').disabled).toBe(true);
  const valid = '💚'.repeat(6);
  await type(tag, `## ${valid}`);
  await act(() => button('추가').click());
  await act(() => {
    linkedPreview().dispatchEvent(new Event('load'));
    firstBoard().click();
  });
  const title = `${'니'.repeat(198)} 트`;
  const titleInput = [...container.querySelectorAll('input')].find(
    (field) => field.value === '니트',
  )!;
  await type(titleInput, title.replace(' ', '    '));
  expect(button('보드에 저장하기').disabled).toBe(false);
  await sendForm();
  expect(calls.saves).toEqual([
    expect.objectContaining({ productTitle: title, tags: [valid], metadataSource: 'CLIENT' }),
  ]);
});

it('keeps extracted fields and draft edits when only the boards request needs a retry', async () => {
  const calls = mockApi({
    boards: [() => new HttpResponse(null, { status: 500 }), () => boardList(board(1, '기본 보드'))],
  });
  await mount(extractedProduct);
  expect(container.querySelector('[role=alert]')?.textContent).toContain(
    '보드를 불러오지 못했어요',
  );
  expect(button('보드에 저장하기').disabled).toBe(true);
  expect(button('새 보드 만들기')).toBeUndefined();
  const image = linkedPreview();
  expect(priceInput().value).toBe('35,690');
  await act(() => image.dispatchEvent(new Event('load')));
  await type(priceInput(), '36000');
  await act(() => button('봄').click());
  await act(async () => {
    button('보드 다시 불러오기').click();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(calls.checks).toBe(1);
  expect(calls.boards).toBe(2);
  expect(linkedPreview()).toBe(image);
  expect(container.querySelector('[role=alert]')).toBeNull();
  await act(() => firstBoard().click());
  await sendForm();
  expect(calls.saves).toEqual([
    expect.objectContaining({ productTitle: '니트', price: 36_000, boardIds: [1], tags: ['봄'] }),
  ]);
});

it('selects a board created inline', async () => {
  mockApi({
    boards: [
      () => boardList(board(1, '기본 보드')),
      () => boardList(board(5, '가을'), board(1, '기본 보드')),
    ],
  });
  server.use(
    http.post('*/api/v1/boards', () => HttpResponse.json(board(5, '가을'), { status: 201 })),
  );
  await mount();
  await act(() => button('새 보드 만들기').click());
  await type(
    container.querySelector<HTMLInputElement>('input[aria-label="새 보드 이름"]')!,
    '가을',
  );
  await act(async () => {
    button('완료').click();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const created = [...container.querySelectorAll('label')].find((label) =>
    label.textContent?.startsWith('가을'),
  );
  expect(created?.querySelector('input')?.checked).toBe(true);
});

it('keeps an overlong extracted title editable and saves all 200 code points after correction', async () => {
  const calls = mockApi();
  const title = '가'.repeat(199) + '🍑';
  await mount({ ...extractedProduct, name: title + '끝' });
  const name = [...container.querySelectorAll('input')].find((e) => e.value === title + '끝')!;
  await act(() => {
    linkedPreview().dispatchEvent(new Event('load'));
    firstBoard().click();
    button('봄').click();
  });
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(button('보드에 저장하기').disabled).toBe(true);
  await sendForm();
  expect(calls.saves).toHaveLength(0);
  await type(name, title);
  expect(button('보드에 저장하기').disabled).toBe(false);
  await sendForm();
  expect(calls.saves).toEqual([expect.objectContaining({ productTitle: title })]);
});

it('only marks the thumbnail ready when the retry actually loads', async () => {
  const calls = mockApi();
  await mount(extractedProduct);
  const submit = button('보드에 저장하기');
  await act(() => {
    firstBoard().click();
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
  await sendForm();
  expect(calls.saves).toEqual([
    expect.objectContaining({ imageUrl: extractedProduct.imageURL, fallbackIcon: null }),
  ]);
});

it('retains the name and price and allows a template when the thumbnail times out', async () => {
  const calls = mockApi();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  await mount(extractedProduct);
  const first = linkedPreview();
  await act(() => vi.advanceTimersByTime(4_000));
  expect(linkedPreview()).not.toBe(first);
  await act(() => vi.advanceTimersByTime(4_000));
  vi.useRealTimers();
  expect(linkedPreview()).toBeNull();
  expect(container.textContent).toContain('상품 이미지를 불러오지 못했어요');
  expect(container.textContent).not.toContain('상품 이미지 사용 중');
  await act(() => {
    firstBoard().click();
    button('봄').click();
  });
  expect(button('보드에 저장하기').disabled).toBe(true);
  await act(() => button('상의').click());
  await sendForm();
  expect(calls.saves).toEqual([
    expect.objectContaining({
      productTitle: '니트',
      price: 35_690,
      imageUrl: null,
      fallbackIcon: 'TOP',
    }),
  ]);
});

it('requires the deployed fields and does not resend an uncertain write', async () => {
  const calls = mockApi({ save: () => new HttpResponse(null, { status: 500 }) });
  await mount();
  const submit = button('보드에 저장하기');
  expect(submit.disabled).toBe(true);
  await act(() => {
    firstBoard().click();
    button('봄').click();
    button('상의').click();
  });
  expect(submit.disabled).toBe(true);
  await type(priceInput(), '0');
  expect(submit.disabled).toBe(false);
  await act(async () => {
    for (const _ of [1, 2]) {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  expect(calls.saves).toEqual([
    {
      productUrl: url,
      sharedUrl: null,
      shop: null,
      productTitle: '니트',
      price: 0,
      memo: null,
      tags: ['봄'],
      boardIds: [1],
      metadataSource: 'MANUAL',
      imageUrl: null,
      imageFileId: null,
      fallbackIcon: 'TOP',
    },
  ]);
  expect(container.querySelector('[role=alert]')?.textContent).toContain(
    '저장 결과를 확인할 수 없어요',
  );
  expect(submit.disabled).toBe(true);
});

it.each([
  [409, 'DUPLICATE_PRODUCT_URL', '이미 저장한 상품 링크예요.', true],
  [400, 'INVALID_REQUEST', '저장하지 못했어요. 다시 시도해 주세요.', false],
] as const)('reports a rejected save (%i)', async (status, code, message, locked) => {
  mockApi({ save: () => HttpResponse.json({ code }, { status }) });
  await mount();
  await act(() => {
    firstBoard().click();
    button('봄').click();
    button('상의').click();
  });
  await type(priceInput(), '1000');
  await sendForm();
  expect(container.querySelector('[role=alert]')?.textContent).toBe(message);
  expect(button('보드에 저장하기').disabled).toBe(locked);
});

it('does not register the product when the image upload fails', async () => {
  const calls = mockApi();
  server.use(http.post('*/api/v1/files/images', () => new HttpResponse(null, { status: 500 })));
  await mount();
  await act(() => {
    firstBoard().click();
    button('봄').click();
    button('이미지 불러오기').click();
  });
  const file = container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(file, 'files', {
    configurable: true,
    value: [new File(['x'], 'card.png', { type: 'image/png' })],
  });
  await act(() => file.dispatchEvent(new Event('change', { bubbles: true })));
  await type(priceInput(), '1000');
  await sendForm();
  expect(calls.saves).toHaveLength(0);
  expect(container.querySelector('[role=alert]')?.textContent).toBe(
    '저장하지 못했어요. 다시 시도해 주세요.',
  );
});

it.each([
  [
    'duplicate',
    () => HttpResponse.json({ canonicalUrl: url, shop: null, supported: true, existingCardId: 3 }),
    '이미 저장한 상품 링크예요.',
  ],
  [
    'unsupported',
    () => HttpResponse.json({ code: 'INVALID_PRODUCT_URL' }, { status: 400 }),
    '지원하지 않는 상품 링크예요.',
  ],
  [
    'auth',
    () => HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }),
    '로그인한 뒤 상품을 저장할 수 있어요.',
  ],
  ['error', () => new HttpResponse(null, { status: 500 }), '상품 정보를 불러오지 못했어요.'],
] as const)('shows the %s lookup state', async (_, check, message) => {
  mockApi({ check });
  server.use(http.post('*/api/v1/auth/reissue', () => new HttpResponse(null, { status: 401 })));
  await mount();
  expect(container.textContent).toContain(message);
});
