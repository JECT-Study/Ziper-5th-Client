import { expect, it } from 'vitest';
import { createRuntime } from './runtime';

it('is SSR-safe and has no shared per-user runtime state', async () => {
  expect(typeof window).toBe('undefined');
  const first = createRuntime();
  const second = createRuntime();
  await Promise.all([first.initialize(), second.initialize()]);
  expect(first.status).toBe('web');
  expect(second.status).toBe('web');
  first.dispose();
  expect(first.status).toBe('closed');
  expect(second.status).toBe('web');
  await expect(second.invoke('authLogoutV1', undefined)).rejects.toMatchObject({
    code: 'UNSUPPORTED',
  });
  second.dispose();
});
