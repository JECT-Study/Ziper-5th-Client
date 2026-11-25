// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Shops } from '@ziper/product-extraction/schema';
import { setAccessToken } from '../../shared/api/session';
import { productSaveWithExtraction } from './product-extraction';

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
afterEach(() => {
  setAccessToken(null);
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('checks the final URL, reuses ETag rules, and falls back to manual mode', async () => {
  const checked = (canonicalUrl: string) =>
    Response.json({ canonicalUrl, shop: '무신사', existingCardId: null });
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ shops }, { headers: { ETag: '"rules"' } }))
    .mockResolvedValueOnce(checked(finalUrl))
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
    .mockResolvedValueOnce(checked(shortUrl));
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValueOnce(extracted).mockResolvedValueOnce(null);
  const api = productSaveWithExtraction(extract);
  const { signal } = new AbortController();
  await expect(api.lookup(shortUrl, signal)).resolves.toMatchObject({
    status: 'ready',
    url: finalUrl,
    product: { name: extracted.name, price: 39000, imageURL },
  });
  expect(fetch.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ url: finalUrl }));
  await expect(api.lookup(shortUrl, signal)).resolves.toEqual({
    status: 'ready',
    url: shortUrl,
    shop: '무신사',
  });
  expect(fetch.mock.calls[2]?.[1]).toMatchObject({
    cache: 'no-store',
    headers: { 'If-None-Match': '"rules"' },
  });
  expect(extract).toHaveBeenLastCalledWith({ url: shortUrl, shops }, signal);
});

it.each([502, 504])(
  'preserves the extracted product when the URL check returns %i once',
  async (status) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ shops }))
      .mockResolvedValueOnce(Response.json({}, { status }))
      .mockResolvedValueOnce(
        Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
      );
    vi.stubGlobal('fetch', fetch);
    const extract = vi.fn().mockResolvedValue(extracted);
    await expect(
      productSaveWithExtraction(extract).lookup(shortUrl, new AbortController().signal),
    ).resolves.toMatchObject({
      status: 'ready',
      url: finalUrl,
      product: { name: extracted.name, price: 39000, imageURL },
    });
    expect(extract).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.slice(1).map(([, init]) => init?.body)).toEqual([
      JSON.stringify({ url: finalUrl }),
      JSON.stringify({ url: finalUrl }),
    ]);
  },
);

it.each([
  ['cold', 503, 200, true],
  ['warm', 503, 403, false],
  ['warm', 304, 403, false],
  ['warm', 304, 200, true],
] as const)(
  'uses the latest rules when a %s request finishes with %i after %i',
  async (cache, late, first, allowed) => {
    const ok = (tag: string) => Response.json({ shops }, { headers: { ETag: tag } });
    let release!: (response: Response) => void;
    const waiting = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const responses = [
      ...(cache === 'warm' ? [ok('"old"')] : []),
      waiting,
      first === 200 ? ok('"new"') : new Response(null, { status: first }),
    ];
    const fetch = vi.fn(async (path: string) =>
      String(path).endsWith('url-check')
        ? Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null })
        : responses.shift(),
    );
    vi.stubGlobal('fetch', fetch);
    const extract = vi.fn().mockResolvedValue(extracted);
    const check = () =>
      productSaveWithExtraction(extract).lookup(finalUrl, new AbortController().signal);
    if (cache === 'warm') await check();
    const slow = check();
    await check();
    extract.mockClear();
    release(new Response(null, { status: late }));
    await slow;
    expect(fetch.mock.calls.filter(([path]) => path.endsWith('/extraction-rules'))).toHaveLength(
      cache === 'warm' ? 3 : 2,
    );
    expect(extract).toHaveBeenCalledTimes(allowed ? 1 : 0);
    const stored = localStorage.getItem('ziper.product-extraction-rules.v1');
    expect(stored && JSON.parse(stored).etag).toBe(allowed ? '"new"' : null);
  },
);

it.each(['quota', 'expired', 'denied'] as const)(
  'uses the current rules decision when storage remains readable after a failed write: %s',
  async (scenario) => {
    vi.resetModules();
    const { productSaveWithExtraction } = await import('./product-extraction');
    vi.useFakeTimers({ toFake: ['Date'] });
    const stored = localStorage;
    const method = scenario === 'denied' ? 'removeItem' : 'setItem';
    vi.stubGlobal('localStorage', {
      getItem: stored.getItem.bind(stored),
      setItem: stored.setItem.bind(stored),
      removeItem: stored.removeItem.bind(stored),
      clear: stored.clear.bind(stored),
      [method]: () => {
        throw new DOMException('not writable', 'QuotaExceededError');
      },
    });
    const statuses = scenario === 'denied' ? [200, 403, 503] : [200, 503];
    const fetch = vi.fn(async (path: string) =>
      String(path).endsWith('url-check')
        ? Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null })
        : Response.json(
            { shops },
            { status: statuses.shift(), headers: { ETag: '"rules"', 'Retry-After': '10' } },
          ),
    );
    vi.stubGlobal('fetch', fetch);
    const extract = vi.fn().mockResolvedValue(extracted);
    const api = productSaveWithExtraction(extract);
    const check = () => api.lookup(finalUrl, new AbortController().signal);
    await check();
    if (scenario === 'denied') await check();
    if (scenario === 'expired') vi.setSystemTime(Date.now() + 300_000);
    extract.mockClear();
    await check();
    expect(extract).toHaveBeenCalledTimes(scenario === 'quota' ? 1 : 0);
  },
);

it.each([
  ['temporary outage', 503, 60_000, true],
  ['interrupted response body', 200, 60_000, true],
  ['interrupted response body with expired rules', 200, 300_000, false],
  ['expired rules', 503, 300_000, false],
  ['sign-in required', 401, 60_000, false],
  ['authorization denied', 403, 60_000, false],
  ['malformed JSON', 200, 60_000, false],
  ['invalid rules schema', 200, 60_000, false],
] as const)('handles %s after a WebView reload', async (scenario, status, elapsed, expected) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const checked = () =>
    Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null });
  const response = scenario.startsWith('interrupted')
    ? new Response(
        new ReadableStream({ start: (stream) => stream.error(new TypeError('connection lost')) }),
        { status },
      )
    : new Response(scenario === 'malformed JSON' ? '{"shops":' : '{}', { status });
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ shops }, { headers: { ETag: '"rules"' } }))
    .mockResolvedValueOnce(checked())
    .mockResolvedValueOnce(response);
  const retries = !expected && (status === 503 || scenario.startsWith('interrupted'));
  if (retries)
    fetch.mockResolvedValueOnce(status === 503 ? Response.json({}, { status }) : response);
  if (status === 401) fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetch.mockResolvedValueOnce(checked()));
  const { signal } = new AbortController();
  await productSaveWithExtraction(vi.fn().mockResolvedValue(extracted)).lookup(finalUrl, signal);

  const cacheKey = 'ziper.product-extraction-rules.v1';
  const original = localStorage.getItem(cacheKey);
  expect(original).not.toBeNull();
  vi.setSystemTime(now + elapsed);
  vi.resetModules();
  const reloaded = await import('./product-extraction');
  const extract = vi.fn().mockResolvedValue(extracted);
  const lookup = await reloaded.productSaveWithExtraction(extract).lookup(finalUrl, signal);
  expect(fetch.mock.calls[2]?.[1]?.headers).toMatchObject({ 'If-None-Match': '"rules"' });
  expect(extract).toHaveBeenCalledTimes(expected ? 1 : 0);
  expect(fetch).toHaveBeenCalledTimes(retries || status === 401 ? 5 : 4);
  expect(localStorage.getItem(cacheKey)).toBe(
    scenario.startsWith('interrupted') || status === 503 ? original : null,
  );
  expect(lookup).toEqual({
    status: 'ready',
    url: finalUrl,
    shop: '무신사',
    ...(expected ? { product: { name: extracted.name, price: extracted.price, imageURL } } : {}),
  });
});

it.each([
  [502, null, true],
  [503, null, true],
  [504, null, true],
  [429, null, false],
  [503, '30', false],
  [403, null, false],
] as const)(
  'bounds cold-start recovery for %i with Retry-After %s',
  async (status, retryAfter, retry) => {
    const headers = retryAfter ? { 'Retry-After': retryAfter } : undefined;
    const checked = Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status, headers }));
    if (retry) fetch.mockResolvedValueOnce(Response.json({ shops }));
    vi.stubGlobal('fetch', fetch.mockResolvedValueOnce(checked));
    const extract = vi.fn().mockResolvedValue(extracted);
    const { signal } = new AbortController();
    const result = await productSaveWithExtraction(extract).lookup(finalUrl, signal);
    expect(
      fetch.mock.calls.filter(([path]) => String(path).endsWith('/extraction-rules')),
    ).toHaveLength(retry ? 2 : 1);
    expect(extract).toHaveBeenCalledTimes(retry ? 1 : 0);
    expect(result).toMatchObject({ status: 'ready', url: finalUrl });
  },
);

it.each(['recovers', 'fails twice', 'follows a gateway error', 'follows Retry-After'] as const)(
  'handles a cold rules body interruption that %s',
  async (scenario) => {
    const interrupted = () =>
      new Response(
        new ReadableStream({ start: (stream) => stream.error(new TypeError('connection lost')) }),
        scenario === 'follows Retry-After' ? { headers: { 'Retry-After': '30' } } : undefined,
      );
    const fetch = vi.fn<typeof globalThis.fetch>();
    if (scenario === 'follows a gateway error')
      fetch.mockResolvedValueOnce(new Response(null, { status: 502 }));
    fetch.mockResolvedValueOnce(interrupted());
    if (scenario === 'recovers') fetch.mockResolvedValueOnce(Response.json({ shops }));
    if (scenario === 'fails twice') fetch.mockResolvedValueOnce(interrupted());
    vi.stubGlobal(
      'fetch',
      fetch.mockResolvedValueOnce(
        Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
      ),
    );
    const extract = vi.fn().mockResolvedValue(extracted);
    const result = await productSaveWithExtraction(extract).lookup(
      finalUrl,
      new AbortController().signal,
    );
    expect(result).toMatchObject({ status: 'ready', url: finalUrl });
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      ...Array.from(
        { length: scenario === 'follows Retry-After' ? 1 : 2 },
        () => '/api/v1/products/extraction-rules',
      ),
      '/api/v1/products/url-check',
    ]);
    expect(extract).toHaveBeenCalledTimes(scenario === 'recovers' ? 1 : 0);
  },
);

it.each(['recovers', 'fails twice', 'after a gateway error', 'uses fresh rules'] as const)(
  'handles a fetch failure before receiving rules headers: %s',
  async (scenario) => {
    const checked = () =>
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null });
    const networkError = new TypeError('Failed to fetch');
    const fetch = vi.fn<typeof globalThis.fetch>();
    if (scenario === 'after a gateway error')
      fetch.mockResolvedValueOnce(new Response(null, { status: 502 }));
    if (scenario === 'uses fresh rules')
      fetch.mockResolvedValueOnce(Response.json({ shops })).mockResolvedValueOnce(checked());
    fetch.mockRejectedValueOnce(networkError);
    if (scenario === 'recovers') fetch.mockResolvedValueOnce(Response.json({ shops }));
    if (scenario === 'fails twice') fetch.mockRejectedValueOnce(networkError);
    vi.stubGlobal('fetch', fetch.mockResolvedValueOnce(checked()));
    const extract = vi.fn().mockResolvedValue(extracted);
    const api = productSaveWithExtraction(extract);
    const signal = new AbortController().signal;
    if (scenario === 'uses fresh rules') {
      await api.lookup(finalUrl, signal);
      fetch.mockClear();
      extract.mockClear();
    }
    const result = await api.lookup(finalUrl, signal);
    expect(result).toMatchObject({ status: 'ready', url: finalUrl });
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/products/extraction-rules',
      ...(scenario === 'uses fresh rules' ? [] : ['/api/v1/products/extraction-rules']),
      '/api/v1/products/url-check',
    ]);
    expect(extract).toHaveBeenCalledTimes(
      scenario === 'recovers' || scenario === 'uses fresh rules' ? 1 : 0,
    );
  },
);

it('does not retry when production CORS can hide Retry-After on a 503', async () => {
  const unavailable = new Response(null, { status: 503 });
  Object.defineProperty(unavailable, 'type', { value: 'cors' });
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(unavailable)
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn();
  await productSaveWithExtraction(extract).lookup(finalUrl, new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(extract).not.toHaveBeenCalled();
});

it('keeps the first cold lookup extracting after a slow but successful cookie refresh', async () => {
  vi.useFakeTimers();
  setAccessToken('old');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      return Response.json({ accessToken: 'new' });
    })
    .mockResolvedValueOnce(Response.json({ shops }))
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValue(extracted);
  const pending = productSaveWithExtraction(extract).lookup(finalUrl, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/products/extraction-rules',
    '/api/v1/auth/reissue',
  ]);
  await vi.advanceTimersByTimeAsync(2_000);
  await expect(pending).resolves.toMatchObject({
    status: 'ready',
    product: { price: extracted.price },
  });
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(fetch.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Refresh-Token-Mode': 'cookie' },
    body: undefined,
    signal: expect.objectContaining({ aborted: false }),
  });
  expect(fetch.mock.calls[2]).toEqual([
    '/api/v1/products/extraction-rules',
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer new' }) }),
  ]);
  expect(extract).toHaveBeenCalledOnce();
});

it('cancels a cold lookup during refresh without losing the next lookup or rotating twice', async () => {
  vi.useFakeTimers();
  const unauthorized = () => Promise.resolve(new Response(null, { status: 401 }));
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(unauthorized)
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      return Response.json({ accessToken: 'new' });
    })
    .mockImplementationOnce(unauthorized)
    .mockResolvedValueOnce(Response.json({ shops }))
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValue(extracted);
  const api = productSaveWithExtraction(extract);
  const controller = new AbortController();
  const first = expect(api.lookup(finalUrl, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  await vi.advanceTimersByTimeAsync(100);
  controller.abort();
  await first;
  expect(fetch).toHaveBeenCalledTimes(2);
  const second = api.lookup(finalUrl, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(2_900);
  await expect(second).resolves.toMatchObject({ product: { price: extracted.price } });
  expect(fetch.mock.calls.filter(([path]) => path === '/api/v1/auth/reissue')).toHaveLength(1);
  expect(extract).toHaveBeenCalledOnce();
});

it('does not reset the rules network budget after the cookie wait', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      return new Response(null, { status: 401 });
    })
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      return Response.json({ accessToken: 'new' });
    })
    .mockImplementationOnce(
      (_, { signal } = {}) =>
        new Promise((_, reject) =>
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true }),
        ),
    )
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn();
  const lookup = productSaveWithExtraction(extract).lookup(finalUrl, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(4_999);
  expect(fetch).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(4);
  await expect(lookup).resolves.toMatchObject({ status: 'ready' });
  expect(extract).not.toHaveBeenCalled();
});

it('uses fresh rules after two seconds without waiting for slow cookie rotation', async () => {
  vi.useFakeTimers();
  localStorage.setItem(
    'ziper.product-extraction-rules.v1',
    JSON.stringify({ shops, confirmedAt: Date.now(), etag: '"one"' }),
  );
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      return Response.json({ accessToken: 'new' });
    })
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValue(extracted);
  const lookup = productSaveWithExtraction(extract).lookup(finalUrl, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(extract).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2_000);
  await expect(lookup).resolves.toMatchObject({
    status: 'ready',
    product: { price: extracted.price },
  });
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/products/extraction-rules',
    '/api/v1/auth/reissue',
    '/api/v1/products/url-check',
    '/api/v1/products/url-check',
  ]);
});

it('lets an immediate user retry recover after a stalled refresh body', async () => {
  vi.useFakeTimers();
  let refreshSignal: AbortSignal | null | undefined;
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockImplementationOnce(async (_, { signal } = {}) => {
      refreshSignal = signal;
      const response = new Response(null, { status: 200 });
      vi.spyOn(response, 'text').mockImplementation(
        () =>
          new Promise((_, reject) =>
            signal?.addEventListener('abort', () => reject(signal.reason), { once: true }),
          ),
      );
      return response;
    });
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValue(extracted);
  const api = productSaveWithExtraction(extract);
  const lookup = () => api.lookup(finalUrl, new AbortController().signal);
  const first = expect(lookup()).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(5_000);
  await first;
  expect(extract).not.toHaveBeenCalled();
  expect(refreshSignal?.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2); // No URL check or second cookie POST after the shared timeout.
  fetch
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
    .mockResolvedValueOnce(Response.json({ shops }))
    .mockResolvedValueOnce(
      Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
    );
  await expect(lookup()).resolves.toMatchObject({
    status: 'ready',
    product: { price: extracted.price },
  });
  expect(extract).toHaveBeenCalledOnce();
});

it.each(['gateway error', 'body interruption', 'fetch rejection'])(
  'shares the two-second rules budget after a %s',
  async (scenario) => {
    vi.useFakeTimers();
    const gatewayError = new Response(null, { status: 503 });
    const interrupted = new Response(null, { status: 200 });
    vi.spyOn(interrupted, 'text').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      throw new TypeError('connection lost');
    });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => {
        if (scenario === 'body interruption') return interrupted;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        if (scenario === 'fetch rejection') throw new TypeError('Failed to fetch');
        return gatewayError;
      })
      .mockImplementationOnce(async (_, { signal } = {}) => {
        await new Promise((_, reject) =>
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
        return gatewayError;
      })
      .mockResolvedValueOnce(
        Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null }),
      );
    vi.stubGlobal('fetch', fetch);
    const extract = vi.fn();
    const pending = productSaveWithExtraction(extract).lookup(
      finalUrl,
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toEqual({ status: 'ready', url: finalUrl, shop: '무신사' });
    expect(
      fetch.mock.calls.filter(([path]) => String(path).endsWith('/extraction-rules')),
    ).toHaveLength(2);
    expect(extract).not.toHaveBeenCalled();
  },
);

it.each([
  ['https://store.musinsa.com/app/goods/7', true],
  ['https://www.musinsa.com/products/8', false],
  ['https://m.a-bly.com/goods/7', false],
] as const)(
  'attaches metadata only when URL-check confirms the same product: %s',
  async (canonicalUrl, sameProduct) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ shops }))
      .mockResolvedValueOnce(Response.json({ canonicalUrl, shop: '무신사', existingCardId: null }));
    vi.stubGlobal('fetch', fetch);
    const extract = vi.fn().mockResolvedValue(extracted);
    const lookup = await productSaveWithExtraction(extract).lookup(
      shortUrl,
      new AbortController().signal,
    );
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

it('renews the cache only when the server confirms its ETag', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const checked = () =>
    Response.json({ canonicalUrl: finalUrl, shop: '무신사', existingCardId: null });
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ shops }, { headers: { ETag: '"rules"' } }))
    .mockResolvedValueOnce(checked())
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
    .mockResolvedValueOnce(checked())
    .mockRejectedValueOnce(new TypeError('network unavailable'))
    .mockResolvedValueOnce(checked());
  vi.stubGlobal('fetch', fetch);
  const extract = vi.fn().mockResolvedValue(extracted);
  const api = productSaveWithExtraction(extract);
  const { signal } = new AbortController();
  await api.lookup(finalUrl, signal);
  vi.setSystemTime(now + 600_000);
  await api.lookup(finalUrl, signal);
  vi.setSystemTime(now + 601_000);
  expect(await api.lookup(finalUrl, signal)).toHaveProperty('product', {
    name: extracted.name,
    price: extracted.price,
    imageURL,
  });
  expect(extract).toHaveBeenCalledTimes(3);
});
