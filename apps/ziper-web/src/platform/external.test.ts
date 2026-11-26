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
it('reserves the tab before resolving the board URL and never resolves a blocked popup', async () => {
  const events: string[] = [];
  const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockImplementation(() => {
    events.push('tab');
    return tab as unknown as Window;
  });
  const target = vi.fn(async () => {
    events.push('request');
    expect(tab.opener).toBeNull();
    return 'https://shop.example/item';
  });
  await openWebExternal(target);
  expect(events).toEqual(['tab', 'request']);
  expect(tab.location.replace).toHaveBeenCalledExactlyOnceWith('https://shop.example/item');
  open.mockReturnValue(null);
  await expect(openWebExternal(target)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  expect(target).toHaveBeenCalledOnce();
});
it('closes its reserved tab without navigating if the deferred URL cannot be resolved', async () => {
  const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  await expect(openWebExternal(async () => 'file:///tmp/item')).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  });
  await expect(
    openWebExternal(async () => {
      throw new Error('request aborted');
    }),
  ).rejects.toThrow('request aborted');
  expect(tab.location.replace).not.toHaveBeenCalled();
  expect(tab.close).toHaveBeenCalledTimes(2);
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
