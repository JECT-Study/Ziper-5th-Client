// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProductUpdate } from '@ziper/api/product-detail';
import { setAccessToken } from '../../shared/api/session';
import { productDetailApi } from './product-detail-api';

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
    headers: { Authorization: 'Bearer test-access' },
  });
  expect(JSON.parse(String(fetchApi.mock.calls[2]?.[1]?.body))).toEqual({
    ...patch,
    imageFileId: 31,
    boardIds: [12],
  });
});

it.each([
  [400, 'failed'],
  [403, 'forbidden'],
  [404, 'not-found'],
] as const)('maps HTTP %i to a confirmed failure', async (status, reason) => {
  reply({}, status);
  await expect(productDetailApi.update('7', patch)).resolves.toMatchObject({
    status: 'rejected',
    reason,
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
