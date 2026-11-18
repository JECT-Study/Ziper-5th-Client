// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createPlatform, createRuntime } from './runtime';
import type { Session } from './contract';
import { deferred } from '../test/deferred';

const signedIn: Session = { status: 'signedIn', profile: { id: 'one', displayName: 'One' } };

function fixture() {
  const runtime = createRuntime({ injectionGraceMs: 0 });
  const session = {
    createTransaction: vi.fn(async () => ({ transactionId: 't' })),
    exchange: vi.fn(async () => signedIn),
    current: vi.fn(async (): Promise<Session | null> => null),
    nativeHandoff: vi.fn(async () => ({ handoffCode: 'test-only' })),
    logout: vi.fn(async () => {}),
  };
  const login = vi.fn(async () => signedIn);
  const platform = createPlatform(runtime, {
    auth: { login, session },
    navigation: {
      push: async () => {},
      replace: async () => {},
      back: async () => {},
      depth: () => 0,
    },
    sheets: { actions: async () => ({ status: 'cancelled' }) },
  });
  onTestFinished(() => {
    platform.dispose();
    runtime.dispose();
  });
  return { session, login, platform };
}

describe('authentication scope ordering', () => {
  it.each(['login', 'restore'] as const)(
    'rejects a stale %s result after logout',
    async (action) => {
      const response = deferred<Session>();
      const f = fixture();
      const adapter = action === 'login' ? f.login : f.session.current;
      adapter.mockReturnValue(response.promise);
      const pending =
        action === 'login' ? f.platform.auth.login('naver') : f.platform.auth.restore();
      await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce());
      await f.platform.auth.logout();
      const rejected = expect(pending).rejects.toThrow('AUTH_FAILED');
      response.resolve(signedIn);
      await rejected;
      expect(f.session.nativeHandoff).not.toHaveBeenCalled();
    },
  );

  it('rejects a second login without starting another provider flow', async () => {
    const response = deferred<Session>();
    const f = fixture();
    f.login.mockReturnValue(response.promise);
    const first = f.platform.auth.login('naver');
    await expect(f.platform.auth.login('kakao')).rejects.toThrow('AUTH_FAILED');
    expect(f.login).toHaveBeenCalledOnce();
    response.resolve(signedIn);
    expect(await first).toEqual(signedIn);
  });

  it('blocks login/restore while logout is still clearing credentials', async () => {
    const response = deferred<void>();
    const f = fixture();
    f.session.logout.mockReturnValue(response.promise);
    const pending = f.platform.auth.logout();
    await expect(f.platform.auth.login('naver')).rejects.toThrow('AUTH_FAILED');
    await expect(f.platform.auth.restore()).rejects.toThrow('AUTH_FAILED');
    expect(f.session.current).not.toHaveBeenCalled();
    response.resolve();
    await pending;
    expect(await f.platform.auth.restore()).toBeNull();
  });
});
