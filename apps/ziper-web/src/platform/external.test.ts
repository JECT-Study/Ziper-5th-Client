// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { openWebExternal } from './external';

afterEach(() => vi.restoreAllMocks());
it.each([
  'javascript:alert(1)',
  'file:///tmp/a',
  '//evil.test',
  'https://user:pass@evil.test',
  'https://example.com/\\\\evil',
  'https://example.com/a b',
])('rejects unsafe external URL %s before opening a tab', async (url) => {
  const open = vi.spyOn(window, 'open');
  await expect(openWebExternal(url)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(open).not.toHaveBeenCalled();
});
it('opens synchronously and removes the opener before navigating', async () => {
  const replace = vi.fn(() => {
    expect(tab.opener).toBeNull();
  });
  const tab = { opener: window, location: { replace }, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  const pending = openWebExternal('https://shop.example/item');
  expect(open).toHaveBeenCalledExactlyOnceWith('about:blank', '_blank');
  expect(replace).toHaveBeenCalledWith('https://shop.example/item');
  await pending;
});
it('reports a popup blocker instead of reporting success', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  await expect(openWebExternal('https://shop.example')).rejects.toMatchObject({
    code: 'PERMISSION_DENIED',
  });
});
it('closes the temporary tab if navigation fails', async () => {
  const close = vi.fn();
  vi.spyOn(window, 'open').mockReturnValue({
    location: {
      replace() {
        throw new Error('blocked');
      },
    },
    close,
  } as unknown as Window);
  await expect(openWebExternal('https://shop.example')).rejects.toThrow('blocked');
  expect(close).toHaveBeenCalledOnce();
});
