import { afterEach, expect, it, vi } from 'vitest';
import { ensureSession } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('does not remember a refresh timeout as a confirmed sign-out', async () => {
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
