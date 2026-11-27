import type { AnyRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createWebNavigation } from './navigation';

function fakeRouter() {
  const location = { pathname: '/', state: { __TSR_index: 0 } };
  const router = { history: { location } } as unknown as AnyRouter;
  const go = (pathname: string, index: number) => {
    location.pathname = pathname;
    location.state = { __TSR_index: index };
  };
  return { router, go };
}

describe('createWebNavigation depth', () => {
  it('counts entries pushed inside the web view', () => {
    const { router, go } = fakeRouter();
    const navigation = createWebNavigation(router);
    go('/login', 0);
    expect(navigation.depth()).toBe(0);
    go('/signup', 1);
    expect(navigation.depth()).toBe(1);
  });

  it('starts over at the signup completion screen so login and terms stay unreachable', () => {
    const { router, go } = fakeRouter();
    const navigation = createWebNavigation(router);
    go('/signup', 1);
    go('/signup/complete', 2);
    expect(navigation.depth()).toBe(0);
    go('/', 2); // 시작하기 is a replace
    expect(navigation.depth()).toBe(0);
    go('/boards/purchased', 3);
    expect(navigation.depth()).toBe(1);
  });
});
