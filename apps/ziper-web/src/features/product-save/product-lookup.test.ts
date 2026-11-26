import { startSession } from '@ziper/api/http';
import type { Shops } from '@ziper/product-extraction/schema';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { server } from '../../test/server';
import { lookupProduct } from './product-lookup';

const shops: Shops = [
  {
    hosts: ['www.musinsa.com'],
    imageHosts: ['image.msscdn.net'],
    imageStrategy: 'SERVER_MIRROR',
    fields: {
      title: ['ldjson:name'],
      price: ['json:__NEXT_DATA__.price'],
      image: ['ldjson:image[0]'],
    },
  },
];
const finalUrl = 'https://www.musinsa.com/products/7';
const shortUrl = 'https://musinsa.onelink.me/sample';
const imageURL = 'https://image.msscdn.net/card.png';
const extracted = { url: finalUrl, name: '가디건', price: 39000, imageURL };
const signal = new AbortController().signal;

type Reply = () => Response;
function mockApi({ rules = [], checks = [] }: { rules?: Reply[]; checks?: Reply[] }) {
  const calls = { rules: [] as Request[], checks: [] as unknown[] };
  server.use(
    http.get('*/api/v1/products/extraction-rules', ({ request }) => {
      calls.rules.push(request);
      return (rules.shift() ?? (() => HttpResponse.json({ shops })))();
    }),
    http.post('*/api/v1/products/url-check', async ({ request }) => {
      calls.checks.push(await request.json());
      return (checks.shift() ?? (() => checked(finalUrl)))();
    }),
    http.post('*/api/v1/auth/reissue', () => new HttpResponse(null, { status: 401 })),
  );
  return calls;
}
const checked = (canonicalUrl: string, existingCardId: number | null = null) =>
  HttpResponse.json({ canonicalUrl, shop: '무신사', supported: true, existingCardId });

const storage = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal('location', new URL('http://localhost:3000/'));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  startSession('token');
});
afterEach(() => {
  startSession(null);
  storage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('checks the final URL, reuses ETag rules, and falls back to manual mode', async () => {
  const calls = mockApi({
    rules: [
      () => HttpResponse.json({ shops }, { headers: { ETag: '"rules"' } }),
      () => new HttpResponse(null, { status: 304 }),
    ],
    checks: [() => checked(finalUrl), () => checked(shortUrl)],
  });
  const extract = vi.fn().mockResolvedValueOnce(extracted).mockResolvedValueOnce(null);
  await expect(lookupProduct(shortUrl, extract, signal)).resolves.toMatchObject({
    status: 'ready',
    url: finalUrl,
    product: { name: extracted.name, price: 39000, imageURL },
  });
  expect(calls.checks[0]).toEqual({ url: finalUrl });
  await expect(lookupProduct(shortUrl, extract, signal)).resolves.toEqual({
    status: 'ready',
    url: shortUrl,
    shop: '무신사',
  });
  expect(calls.rules[1]?.headers.get('If-None-Match')).toBe('"rules"');
  expect(extract).toHaveBeenLastCalledWith({ url: shortUrl, shops }, signal);
});

it.each([
  ['https://store.musinsa.com/app/goods/7', true],
  ['https://www.musinsa.com/products/8', false],
  ['https://m.a-bly.com/goods/7', false],
] as const)(
  'attaches metadata only when URL-check confirms the same product: %s',
  async (canonicalUrl, sameProduct) => {
    mockApi({ checks: [() => checked(canonicalUrl)] });
    const lookup = await lookupProduct(shortUrl, vi.fn().mockResolvedValue(extracted), signal);
    expect(lookup).toEqual({
      status: 'ready',
      url: canonicalUrl,
      shop: '무신사',
      ...(sameProduct
        ? { product: { name: extracted.name, price: extracted.price, imageURL } }
        : {}),
    });
  },
);

it('only checks the URL without reading rules when extraction is unavailable', async () => {
  const calls = mockApi({ checks: [() => checked(shortUrl)] });
  await expect(lookupProduct(shortUrl, null, signal)).resolves.toEqual({
    status: 'ready',
    url: shortUrl,
    shop: '무신사',
  });
  expect(calls.rules).toHaveLength(0);
});

it.each([
  ['duplicate', () => checked(finalUrl, 7)],
  ['auth-required', () => HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })],
  ['unsupported', () => HttpResponse.json({ code: 'INVALID_PRODUCT_URL' }, { status: 400 })],
] as const)('maps the URL check to %s', async (status, reply) => {
  mockApi({ checks: [reply, reply] });
  await expect(lookupProduct(finalUrl, null, signal)).resolves.toEqual({ status });
});

it('throws other URL check failures so the screen can retry', async () => {
  mockApi({ checks: [() => new HttpResponse(null, { status: 500 })] });
  await expect(lookupProduct(finalUrl, null, signal)).rejects.toMatchObject({ status: 500 });
});

it('keeps manual entry available when the rules service fails', async () => {
  mockApi({
    rules: [() => new HttpResponse(null, { status: 503 })],
    checks: [() => checked(finalUrl)],
  });
  const extract = vi.fn();
  await expect(lookupProduct(finalUrl, extract, signal)).resolves.toEqual({
    status: 'ready',
    url: finalUrl,
    shop: '무신사',
  });
  expect(extract).not.toHaveBeenCalled();
});

it('uses fresh cached rules on a server error but drops them on a client error', async () => {
  mockApi({
    rules: [
      () => HttpResponse.json({ shops }, { headers: { ETag: '"rules"' } }),
      () => new HttpResponse(null, { status: 503 }),
      () => new HttpResponse(null, { status: 404 }),
      () => new HttpResponse(null, { status: 503 }),
    ],
  });
  const extract = vi.fn().mockResolvedValue(extracted);
  for (let i = 0; i < 4; i++) await lookupProduct(finalUrl, extract, signal);
  expect(extract).toHaveBeenCalledTimes(2);
});

it('renews the cache only when the server confirms its ETag', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  mockApi({
    rules: [
      () => HttpResponse.json({ shops }, { headers: { ETag: '"rules"' } }),
      () => new HttpResponse(null, { status: 304 }),
      () => HttpResponse.error(),
    ],
  });
  const extract = vi.fn().mockResolvedValue(extracted);
  await lookupProduct(finalUrl, extract, signal);
  vi.setSystemTime(now + 600_000);
  await lookupProduct(finalUrl, extract, signal);
  vi.setSystemTime(now + 601_000);
  expect(await lookupProduct(finalUrl, extract, signal)).toHaveProperty('product', {
    name: extracted.name,
    price: extracted.price,
    imageURL,
  });
  expect(extract).toHaveBeenCalledTimes(3);
});
