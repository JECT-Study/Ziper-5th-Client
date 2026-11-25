// @vitest-environment happy-dom
import type { ProductSaveInput } from '@ziper/api/product-save';
import { afterEach, expect, it, vi } from 'vitest';
import { productSaveApi } from './product-save-api';

const productUrl = 'https://shop.example/item';
const input = {
  url: productUrl,
  shop: '',
  sharedUrl: null,
  name: '니트',
  price: 39000,
  memo: '',
  boardIds: ['1'],
  tags: ['가을'],
  metadataSource: 'MANUAL',
  image: { kind: 'template', id: 'TOP' },
} satisfies ProductSaveInput;

function replies(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  responses.forEach((response) => fetch.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('accepts an unlisted shop and detects an existing card before save', async () => {
  const signal = new AbortController().signal;
  const dto = { canonicalUrl: productUrl, shop: null, supported: false };
  replies(
    Response.json({ ...dto, existingCardId: null }),
    Response.json({ ...dto, existingCardId: 7 }),
  );
  await expect(productSaveApi.lookup(productUrl, signal)).resolves.toEqual({
    status: 'ready',
    url: productUrl,
    shop: '',
  });
  await expect(productSaveApi.lookup(productUrl, signal)).resolves.toEqual({ status: 'duplicate' });
});

it.each([
  [403, undefined],
  [429, undefined],
  [503, undefined],
  [502, '5'],
])('does not retry URL check on status %i with Retry-After %s', async (status, retryAfter) => {
  const fetch = replies(
    Response.json(
      {},
      {
        status,
        headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
      },
    ),
  );
  await expect(
    productSaveApi.lookup(productUrl, new AbortController().signal),
  ).rejects.toMatchObject({ status });
  expect(fetch).toHaveBeenCalledOnce();
});

const interrupted = (status = 200, headers?: HeadersInit) =>
  new Response(
    new ReadableStream({ start: (stream) => stream.error(new TypeError('connection lost')) }),
    { status, headers },
  );

it.each(['headers', 'successful response body'])(
  'recovers the same URL check after transport failure before reading %s',
  async (failure) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    if (failure === 'headers') fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    else fetch.mockResolvedValueOnce(interrupted());
    fetch.mockResolvedValueOnce(
      Response.json({ canonicalUrl: productUrl, shop: null, existingCardId: 7 }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(productSaveApi.lookup(productUrl, new AbortController().signal)).resolves.toEqual({
      status: 'duplicate',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]).toEqual(fetch.mock.calls[1]);
  },
);

it.each([
  ['rate-limited body', () => interrupted(429)],
  ['denied body', () => interrupted(403)],
  ['Retry-After', () => interrupted(200, { 'Retry-After': '10' })],
  ['malformed body', () => new Response('{')],
] as const)('does not retry URL check after %s', async (_, response) => {
  const fetch = replies(response());
  await expect(productSaveApi.lookup(productUrl, new AbortController().signal)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});

it('shares a single URL check retry between gateway and transport errors', async () => {
  const fetch = replies(new Response(null, { status: 502 }), interrupted());
  await expect(productSaveApi.lookup(productUrl, new AbortController().signal)).rejects.toThrow(
    'connection lost',
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not retry a URL check canceled while reading its body', async () => {
  const controller = new AbortController();
  const response = new Response();
  vi.spyOn(response, 'text').mockImplementationOnce(async () => {
    controller.abort();
    throw new TypeError('connection lost');
  });
  const fetch = replies(response);
  await expect(productSaveApi.lookup(productUrl, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(fetch).toHaveBeenCalledOnce();
});

it('shares one URL check deadline across a slow response and its only retry', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(Response.json({}, { status: 504 })), 4_800),
        ),
    )
    .mockReturnValueOnce(new Promise(() => {}));
  vi.stubGlobal('fetch', fetch);
  const lookup = productSaveApi.lookup(productUrl, new AbortController().signal);
  const rejected = expect(lookup).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(5_000);
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
});

it('surfaces a second gateway failure without a third URL check', async () => {
  const fetch = replies(Response.json({}, { status: 502 }), Response.json({}, { status: 504 }));
  await expect(
    productSaveApi.lookup(productUrl, new AbortController().signal),
  ).rejects.toMatchObject({ status: 504 });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('keeps the duplicate check authoritative after a gateway error', async () => {
  const fetch = replies(
    Response.json({}, { status: 502 }),
    Response.json({ canonicalUrl: productUrl, shop: null, existingCardId: 7 }),
  );
  await expect(productSaveApi.lookup(productUrl, new AbortController().signal)).resolves.toEqual({
    status: 'duplicate',
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('uploads a multipart file then registers with numeric IDs', async () => {
  const fetch = replies(
    Response.json({ fileId: 31 }, { status: 201 }),
    Response.json({ cardId: 7 }, { status: 201 }),
  );
  const file = new File(['image'], 'card.png', { type: 'image/png' });
  await expect(productSaveApi.save({ ...input, image: { kind: 'upload', file } })).resolves.toEqual(
    {
      cardId: '7',
    },
  );
  const [upload, registration] = fetch.mock.calls;
  expect(upload?.[0]).toBe('/api/v1/files/images');
  expect(upload?.[1]?.headers).not.toHaveProperty('Content-Type');
  const body = upload?.[1]?.body;
  expect(body instanceof FormData && body.get('file')).toMatchObject({ name: 'card.png' });
  expect(registration?.[0]).toBe('/api/v1/products');
  expect(JSON.parse(String(registration?.[1]?.body))).toMatchObject({
    productUrl,
    productTitle: '니트',
    price: 39000,
    boardIds: [1],
    tags: ['가을'],
    imageFileId: 31,
    fallbackIcon: null,
    metadataSource: 'MANUAL',
  });
});

it('distinguishes duplicate from a possible commit with a server error', async () => {
  const fetch = replies(
    Response.json({ code: 'DUPLICATE_PRODUCT_URL' }, { status: 409 }),
    Response.json({}, { status: 500 }),
  );
  await expect(productSaveApi.save(input)).resolves.toBe('duplicate');
  await expect(productSaveApi.save(input)).rejects.toMatchObject({ status: 500 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
