// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProductUpdate } from '@ziper/api/product-detail';
import { ApiError } from '../../shared/api/http';
import { setAccessToken } from '../../shared/api/session';
import { productDetailApi, productPurchases } from './product-detail-api';

const card = {
  cardId: 7,
  productUrl: 'https://shop.example/item',
  productTitle: '니트',
  shop: null,
  memo: null,
  price: 0,
  imageUrl: null,
  imageFileId: 31,
  imageFileUrl: 'https://storage.example/signed',
  imageStatus: 'READY',
  fallbackIcon: 'TOP',
  status: 'PLANNED',
  link: { status: 'SOLD_OUT' },
  tags: [{ title: '가을' }],
  boards: [{ boardId: 12, name: '기본 보드' }],
};
const patch = {
  productTitle: '가을 니트',
  shop: '',
  memo: '',
  price: 0,
  imageUrl: null,
  imageFileId: '31',
  fallbackIcon: 'TOP',
  boardIds: ['12'],
  tags: ['가을'],
} satisfies ProductUpdate;
const path = '/api/v1/products/7';
const fetchApi = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
const reply = (body: unknown, status = 200) =>
  fetchApi.mockResolvedValueOnce(Response.json(body, { status }));

beforeEach(() => {
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
  setAccessToken('test-access');
});
afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

it('maps deployed reads and sends a PATCH with numeric IDs, not the signed URL', async () => {
  const requestSignal = signal();
  reply(card);
  reply({ boards: card.boards });
  reply({ ...card, productTitle: patch.productTitle });
  reply({ cardId: 7 });
  const boards = [{ id: '12', name: '기본 보드' }];
  await expect(productDetailApi.get('7', requestSignal)).resolves.toMatchObject({
    cardId: '7',
    shop: '',
    memo: '',
    price: 0,
    imageFileId: '31',
    imageFileUrl: card.imageFileUrl,
    imageStatus: 'READY',
    linkStatus: 'SOLD_OUT',
    tags: ['가을'],
    boards,
  });
  await expect(productDetailApi.listBoards(requestSignal)).resolves.toEqual(boards);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'done',
    value: { productTitle: patch.productTitle },
  });
  await productDetailApi.openOriginal('7');
  expect(fetchApi.mock.calls.map(([target, init]) => [target, init?.method])).toEqual([
    [path, 'GET'],
    ['/api/v1/boards', 'GET'],
    [path, 'PATCH'],
    [path + '/open-original', 'POST'],
  ]);
  expect(fetchApi.mock.calls[0]?.[1]).toMatchObject({
    signal: requestSignal,
    cache: 'no-store',
    headers: { Authorization: 'Bearer test-access' },
  });
  expect(JSON.parse(String(fetchApi.mock.calls[2]?.[1]?.body))).toEqual({
    ...patch,
    imageFileId: 31,
    boardIds: [12],
  });
});

it('creates a board using the deployed board command and reads its count', async () => {
  reply({ boardId: 3, name: '새 테스트', productCount: 0 }, 201);
  await expect(productDetailApi.createBoard('새 테스트')).resolves.toEqual({
    id: '3',
    name: '새 테스트',
    productCount: 0,
  });
  expect(fetchApi).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/boards',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: '새 테스트' }),
    }),
  );
});

it.each([
  [400, 'failed'],
  [403, 'forbidden'],
] as const)('maps HTTP %i to a confirmed failure', async (status, reason) => {
  reply({}, status);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'rejected',
    reason,
  });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('does not map a renewal denial to denied edit or replay the PATCH', async () => {
  reply({}, 401);
  reply({ code: 'FORBIDDEN' }, 403);
  await expect(productDetailApi.update('7', patch)).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi.mock.calls.map(([target, options]) => [target, options?.method])).toEqual([
    [path, 'PATCH'],
    ['/api/v1/auth/reissue', 'POST'],
  ]);
});

it('requires reconciliation for an unclassified PATCH 404', async () => {
  reply({}, 404);
  await expect(productDetailApi.update('7', patch)).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it.each([
  ['FILE_NOT_FOUND', 'image-unusable'],
  ['BOARD_NOT_FOUND', 'board-not-found'],
  ['PRODUCT_CARD_NOT_FOUND', 'not-found'],
] as const)('maps PATCH 404 %s without replaying the edit', async (code, reason) => {
  reply({ code }, 404);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'rejected',
    reason,
  });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('reports a rejected existing image URL separately from other validation errors', async () => {
  reply({ code: 'INVALID_PRODUCT_IMAGE_URL' }, 400);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'rejected',
    reason: 'image-unusable',
  });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('does not repeat or report success after a 5xx or malformed success', async () => {
  reply({}, 502);
  reply({ cardId: 7 });
  await expect(productDetailApi.update('7', patch)).resolves.toEqual({ status: 'unknown' });
  await expect(productDetailApi.update('7', patch)).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi).toHaveBeenCalledTimes(2);
});

it('does not report success for a different card ID', async () => {
  reply({ ...card, cardId: 8 });
  await expect(productDetailApi.update('7', patch)).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('allows an original photo to gain a mirror file', async () => {
  const imageUrl = 'https://shop.example/original.jpg';
  reply({ ...card, imageUrl, productTitle: patch.productTitle });
  await expect(
    productDetailApi.update('7', { ...patch, imageFileId: null, imageUrl }),
  ).resolves.toMatchObject({ status: 'done', value: { imageUrl, imageFileId: '31' } });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it.each(['　가을  니트\t', '<b>가을 니트</b>'])(
  'accepts server-normalized title %j and deduplicated board and tag lists in a different order',
  async (productTitle) => {
    reply({
      ...card,
      boards: [{ boardId: 13, name: '새 보드' }, ...card.boards],
      tags: [{ title: '봄' }, ...card.tags],
      memo: '\u00a0메모\u202f',
      productTitle: patch.productTitle,
    });
    await expect(
      productDetailApi.update('7', {
        ...patch,
        productTitle,
        tags: [' #가을', '봄', '가을'],
        memo: ' \t\u00a0메모\u202f\u3000',
        boardIds: ['12', '13', '12'],
      }),
    ).resolves.toMatchObject({
      status: 'done',
      value: { memo: '\u00a0메모\u202f', productTitle: patch.productTitle, tags: ['봄', '가을'] },
    });
    expect(fetchApi).toHaveBeenCalledOnce();
  },
);

it('rejects invalid paths and IDs before sending them', async () => {
  await expect(productDetailApi.get('7/open-original', signal())).rejects.toMatchObject({
    code: 'not-found',
  });
  await expect(
    productDetailApi.update('7', { ...patch, boardIds: ['9007199254740993'] }),
  ).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi).not.toHaveBeenCalled();
  reply({ boards: [{ boardId: Number.MAX_SAFE_INTEGER + 1, name: '보드' }] });
  await expect(productDetailApi.listBoards(signal())).rejects.toThrow('Invalid API response');
});

it('maps the provisional purchase and cursor requests without fetching any detail', async () => {
  reply({ cardId: 7, status: 'PURCHASED', affectedBoardCount: 2 });
  reply({ items: [{ ...card, price: null }], nextCursor: 'cursor+2' });
  const requestSignal = signal();
  await expect(productPurchases.complete('7')).resolves.toMatchObject({
    status: 'done',
    value: { cardId: '7', status: 'PURCHASED', affectedBoardCount: 2 },
  });
  await expect(productPurchases.list('PRICE_ASC', requestSignal, 'one/two')).resolves.toMatchObject(
    {
      items: [{ cardId: '7', price: null, tags: ['가을'] }],
      nextCursor: 'cursor+2',
    },
  );
  expect(fetchApi.mock.calls.map(([target, init]) => [target, init?.method])).toEqual([
    [path + '/purchase', 'POST'],
    ['/api/v1/products/purchased?sort=PRICE_ASC&size=20&cursor=one%2Ftwo', 'GET'],
  ]);
});

it('allows a missing purchase-list price but requires a price on detail', async () => {
  reply({ ...card, price: null });
  await expect(productDetailApi.get('7', signal())).rejects.toThrow('Invalid API response');
  reply({ items: [{ ...card, price: null }], nextCursor: null });
  await expect(productPurchases.list('PRICE_DESC', signal())).resolves.toMatchObject({
    items: [{ price: null, shop: '', tags: ['가을'], linkStatus: 'SOLD_OUT' }],
  });
});

it('does not infer a purchase result or replay a POST after a conflict', async () => {
  reply({ code: 'ALREADY_PURCHASED' }, 409);
  reply({ ...card, status: 'PURCHASED' });
  await expect(productPurchases.complete('7')).resolves.toEqual({ status: 'unknown' });
  await expect(productDetailApi.get('7', signal())).resolves.toMatchObject({ status: 'PURCHASED' });
  expect(fetchApi.mock.calls.map(([target, init]) => [target, init?.method])).toEqual([
    [path + '/purchase', 'POST'],
    [path, 'GET'],
  ]);
});

it('preserves a rejected purchased-list cursor without retrying the request', async () => {
  reply({ code: 'INVALID_CURSOR' }, 400);
  await expect(productPurchases.list('RECENT', signal(), 'stale')).rejects.toMatchObject({
    status: 400,
    code: 'INVALID_CURSOR',
  });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('never treats a mismatched purchase response as success', async () => {
  reply({ cardId: 8, status: 'PURCHASED', affectedBoardCount: 2 });
  await expect(productPurchases.complete('7')).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi.mock.calls.map(([target, init]) => [target, init?.method])).toEqual([
    [path + '/purchase', 'POST'],
  ]);
});

it.each(['purchase', 'open-original'] as const)('times out %s without retrying', async (action) => {
  vi.useFakeTimers();
  try {
    fetchApi.mockImplementationOnce(
      (_path, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const assertion =
      action === 'purchase'
        ? expect(productPurchases.complete('7')).resolves.toEqual({ status: 'unknown' })
        : expect(productDetailApi.openOriginal('7')).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(fetchApi).toHaveBeenCalledExactlyOnceWith(`${path}/${action}`, expect.anything());
  } finally {
    vi.useRealTimers();
  }
});

it.each([{}, { cardId: 8 }])(
  'does not accept an unconfirmed visit acknowledgement %j',
  async (body) => {
    reply(body);
    await expect(productDetailApi.openOriginal('7')).rejects.toThrow('Invalid API response');
    expect(fetchApi).toHaveBeenCalledExactlyOnceWith(`${path}/open-original`, expect.anything());
  },
);

it.each([
  [path, () => productDetailApi.get('7', signal())],
  [path + '/open-original', () => productDetailApi.openOriginal('7')],
] as const)('maps only a product-specific 404 from %s to a missing card', async (target, run) => {
  reply({}, 404);
  reply({ code: 'PRODUCT_CARD_NOT_FOUND' }, 404);
  await expect(run()).rejects.toBeInstanceOf(ApiError);
  await expect(run()).rejects.toMatchObject({ code: 'not-found' });
  expect(fetchApi.mock.calls.map(([path]) => path)).toEqual([target, target]);
});

it('does not start an original visit record after its screen has left', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(productDetailApi.openOriginal('7', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetchApi).not.toHaveBeenCalled();
});

it('reports an expired session without replaying the mutation when reissue is denied', async () => {
  reply({}, 401);
  reply({}, 401);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'rejected',
    reason: 'auth-required',
  });
  expect(fetchApi.mock.calls.map(([target]) => target)).toEqual([path, '/api/v1/auth/reissue']);
});

it('requires reconciliation for the fixture-only duplicate purchase conflict', async () => {
  reply({ code: 'ALREADY_PURCHASED' }, 409);
  await expect(productPurchases.complete('7')).resolves.toEqual({ status: 'unknown' });
  expect(fetchApi).toHaveBeenCalledOnce();
});

it('does not retry an aborted read after refreshing its access token', async () => {
  const controller = new AbortController();
  reply({}, 401);
  fetchApi.mockImplementationOnce(async () => {
    controller.abort();
    return Response.json({ accessToken: 'renewed' });
  });
  await expect(productDetailApi.get('7', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetchApi.mock.calls.map(([target]) => target)).toEqual([path, '/api/v1/auth/reissue']);
});
