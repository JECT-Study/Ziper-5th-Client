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

afterEach(() => vi.unstubAllGlobals());

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
