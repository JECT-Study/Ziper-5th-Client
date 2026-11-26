import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { deferred } from '../../bridge/test/deferred';

beforeEach(() => vi.resetModules());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('does not remember a refresh timeout as a confirmed sign-out', async () => {
  const { ensureSession } = await import('./http');
  vi.useFakeTimers();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(
      (_, { signal } = {}) =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  const stalled = expect(ensureSession()).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(5_000);
  await stalled;
  expect(fetch).toHaveBeenCalledOnce();
  await expect(ensureSession()).resolves.toBe(false);
  await expect(ensureSession()).resolves.toBe(false);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([
  [
    'server unavailable',
    () => new Response(null, { status: 503 }),
    { name: 'SessionRenewalError', cause: { status: 503 } },
  ],
  [
    'forbidden',
    () => new Response(null, { status: 403 }),
    { name: 'SessionRenewalError', cause: { status: 403 } },
  ],
  [
    'malformed success',
    () => Response.json({ accessToken: '' }),
    { message: 'Invalid session response' },
  ],
  [
    'network failure',
    () => {
      throw new TypeError('fetch failed');
    },
    { name: 'TypeError' },
  ],
] as const)('does not cache %s from reissue as sign-out', async (_, failure, expected) => {
  const { ensureSession } = await import('./http');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(async () => failure())
    .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }));
  vi.stubGlobal('fetch', fetch);

  await expect(ensureSession()).rejects.toMatchObject(expected);
  await expect(ensureSession()).resolves.toBe(true);
  await expect(ensureSession()).resolves.toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  'only clears the rejected renewed token (concurrent login: %s)',
  async (signedIn) => {
    const { ensureSession, http, startSession } = await import('./http');
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
      .mockImplementationOnce(async () => {
        if (signedIn) startSession('new-login');
        return new Response(null, { status: 401 });
      });
    vi.stubGlobal('fetch', fetch);
    startSession('old');

    await expect(http('/api/v1/products/7', { method: 'GET' })).rejects.toMatchObject({
      status: 401,
    });
    expect(new Headers(fetch.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer renewed',
    );
    await expect(ensureSession()).resolves.toBe(signedIn);
    expect(fetch).toHaveBeenCalledTimes(3);
  },
);

it('uses the token already renewed by a parallel detail read when the earlier 401 arrives late', async () => {
  const { http, startSession } = await import('./http');
  const late = deferred<Response>();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
    .mockResolvedValueOnce(Response.json({ cardId: 7 }))
    .mockResolvedValueOnce(Response.json({ updated: true }));
  vi.stubGlobal('fetch', fetch);
  startSession('old');

  const edit = http('/api/v1/products/7', { method: 'PATCH' });
  await expect(http('/api/v1/products/7', { method: 'GET' })).resolves.toMatchObject({
    data: { cardId: 7 },
  });
  late.resolve(new Response(null, { status: 401 }));
  await expect(edit).resolves.toMatchObject({ data: { updated: true } });
  expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
    ['/api/v1/products/7', 'PATCH'],
    ['/api/v1/products/7', 'GET'],
    ['/api/v1/auth/reissue', 'POST'],
    ['/api/v1/products/7', 'GET'],
    ['/api/v1/products/7', 'PATCH'],
  ]);
  expect(new Headers(fetch.mock.calls[4]?.[1]?.headers).get('Authorization')).toBe(
    'Bearer renewed',
  );
});

it.each([401, 403, 503])(
  'handles a late edit after parallel reissue returns %i',
  async (status) => {
    const { http, startSession, ensureSession } = await import('./http');
    const late = deferred<Response>();
    const unauthorized = () => new Response(null, { status: 401 });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
      .mockResolvedValueOnce(Response.json({ updated: true }));
    vi.stubGlobal('fetch', fetch);
    startSession('old');

    const edit = http('/api/v1/products/7', { method: 'PATCH' });
    const result =
      status === 401
        ? expect(edit).rejects.toMatchObject({ status: 401 })
        : expect(edit).resolves.toMatchObject({ data: { updated: true } });
    await expect(http('/api/v1/boards', { method: 'GET' })).rejects.toMatchObject(
      status === 401 ? { status } : { name: 'SessionRenewalError', cause: { status } },
    );
    late.resolve(unauthorized());
    await result;
    await expect(ensureSession()).resolves.toBe(status !== 401);
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/api/v1/products/7', 'PATCH'],
      ['/api/v1/boards', 'GET'],
      ['/api/v1/auth/reissue', 'POST'],
      ...(status !== 401
        ? [
            ['/api/v1/auth/reissue', 'POST'],
            ['/api/v1/products/7', 'PATCH'],
          ]
        : []),
    ]);
  },
);

it('distinguishes a reissue 403 from a resource 403 after a later successful reissue', async () => {
  const { ApiError, SessionRenewalError, http, startSession } = await import('./http');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
    .mockResolvedValueOnce(Response.json({ code: 'FORBIDDEN' }, { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  startSession('old');
  const list = () => http('/api/v1/products/purchased?cursor=next', { method: 'GET' });
  await expect(list()).rejects.toBeInstanceOf(SessionRenewalError);
  expect(fetch).toHaveBeenCalledTimes(2);
  await expect(list()).rejects.toBeInstanceOf(ApiError);
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/products/purchased?cursor=next',
    '/api/v1/auth/reissue',
    '/api/v1/products/purchased?cursor=next',
    '/api/v1/auth/reissue',
    '/api/v1/products/purchased?cursor=next',
  ]);
});

it.each(['new-login', null])(
  'does not replay a prior user mutation after the session changes to %s',
  async (token) => {
    const { http, startSession } = await import('./http');
    const late = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValueOnce(late.promise);
    vi.stubGlobal('fetch', fetch);
    startSession('old');
    const edit = expect(http('/api/v1/products/7', { method: 'PATCH' })).rejects.toMatchObject({
      status: 401,
    });
    startSession(token);
    late.resolve(new Response(null, { status: 401 }));
    await edit;
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it.each([
  ['new-login', () => new Response(null, { status: 401 })],
  [null, () => Response.json({ accessToken: 'obsolete' })],
] as const)(
  'does not overwrite a session change to %s while reissue is in flight',
  async (token, reply) => {
    const { ensureSession, http, startSession } = await import('./http');
    const reissue = deferred<Response>();
    const started = deferred<void>();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockImplementationOnce(() => {
        started.resolve();
        return reissue.promise;
      });
    vi.stubGlobal('fetch', fetch);
    startSession('old');
    const purchase = expect(
      http('/api/v1/products/7/purchase', { method: 'POST' }),
    ).rejects.toMatchObject({ status: 401 });
    await started.promise;
    startSession(token);
    reissue.resolve(reply());
    await purchase;
    await expect(ensureSession()).resolves.toBe(Boolean(token));
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

it('notifies only when a different account signs in', async () => {
  const { onUserChange, startSession } = await import('./http');
  const token = (sub: string) => `x.${btoa(JSON.stringify({ sub }))}.y`;
  const listener = vi.fn();
  onUserChange(listener);
  startSession(token('1'));
  startSession(null);
  startSession(token('1'));
  expect(listener).not.toHaveBeenCalled();
  startSession(token('2'));
  expect(listener).toHaveBeenCalledOnce();
});
