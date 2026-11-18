import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { DeviceEventEmitter, Platform } from 'react-native';
import { afterEach, expect, it, vi } from 'vitest';
import { success } from '@ziper/bridge/contract';
import type { BridgeDelegate } from '@webview-bridge/react-native';
import type { NativeBridge } from '@ziper/bridge/native';
import RootLayout from '../src/app/_layout';
import HomeRoute from '../src/app/index';
import WebRoute from '../src/app/web';
import { redirectSystemPath } from '../src/app/+native-intent';

const sharing = vi.hoisted(() => ({
  payloads: [] as { shareType: 'url'; value: string }[],
  clear: vi.fn(() => {
    sharing.payloads = [];
  }),
  read: vi.fn(() => sharing.payloads),
}));
vi.mock('expo-sharing', () => ({
  getSharedPayloads: sharing.read,
  clearSharedPayloads: sharing.clear,
}));

const mockWebView = vi.hoisted(() => ({ delegate: null as BridgeDelegate<NativeBridge> | null }));
vi.mock('../src/bridge/webview', async () => {
  const { Text } = await import('react-native');
  return {
    WebView: ({
      delegate,
      source,
    }: {
      delegate: BridgeDelegate<NativeBridge>;
      source: { uri: string };
    }) => {
      mockWebView.delegate = delegate;
      return <Text>WebView: {source.uri}</Text>;
    },
  };
});
vi.mock('@expo/ui', () => ({ BottomSheet: () => null }));

const routes = {
  _layout: RootLayout,
  index: HomeRoute,
  web: WebRoute,
  '+native-intent': { redirectSystemPath },
};

it('reads a warm Expo share from the Linking wake signal', async () => {
  await renderRouter(routes);
  expect(redirectSystemPath({ path: 'ziper://expo-sharing', initial: false })).toBeNull();
  const page = mockWebView.delegate!;
  expect(await page.shareReadV1()).toEqual(success(null));
  sharing.payloads = [{ shareType: 'url', value: 'https://example.com/warm' }];
  await act(() => {
    DeviceEventEmitter.emit('url', { url: 'ziper://expo-sharing' });
  });
  expect(await page.shareReadV1()).toEqual(
    success({ id: 'share-1', url: 'https://example.com/warm' }),
  );
});

it('keeps a cold-start share across native screens and only lets the focused screen dismiss it', async () => {
  sharing.payloads = [{ shareType: 'url', value: 'https://example.com/product?x=1' }];
  const rendered = await renderRouter(routes, { initialUrl: 'ziper://expo-sharing' });
  expect(rendered.getPathname()).toBe('/');
  const home = mockWebView.delegate!;
  const share = { id: 'share-1', url: 'https://example.com/product?x=1' };
  expect(await home.shareReadV1()).toEqual(success(share));
  expect(sharing.payloads).toEqual([]);
  await act(() => router.push({ pathname: '/web', params: { path: '/product' } }));
  expect(await home.shareDismissV1({ id: share.id })).toMatchObject({ ok: false });
  const product = mockWebView.delegate!;
  expect(await product.shareReadV1()).toEqual(success(share));
  expect(await product.shareDismissV1({ id: share.id })).toEqual(success({ done: true }));
  expect(await product.shareReadV1()).toEqual(success(null));
});

afterEach(() => {
  mockWebView.delegate = null;
  vi.useRealTimers();
});

it('resolves a deep link and passes its decoded path to the web screen', async () => {
  expect(Platform.OS).toBe(process.env.TEST_NATIVE_PLATFORM);
  const rendered = await renderRouter(routes, { initialUrl: '/web?path=%2Fitems%3Ftab%3Dall' });
  expect(rendered.getPathname()).toBe('/web');
  expect(rendered.getSearchParams()).toEqual({ path: '/items?tab=all' });
  expect(screen.getByText(/WebView: .*\/items\?tab=all$/)).toBeTruthy();
});

it('pushes, replaces and goes back without retaining the replaced screen', async () => {
  const rendered = await renderRouter(routes);
  expect(screen.getByText(/WebView: .*\/$/)).toBeTruthy();
  await act(() => router.push({ pathname: '/web', params: { path: '/first' } }));
  expect(screen.getByText(/WebView: .*\/first$/)).toBeTruthy();
  expect(router.canGoBack()).toBe(true);
  await act(() => router.replace({ pathname: '/web', params: { path: '/second' } }));
  expect(rendered.getSearchParams()).toEqual({ path: '/second' });
  expect(screen.getByText(/WebView: .*\/second$/)).toBeTruthy();
  await act(() => router.back());
  expect(rendered.getPathname()).toBe('/');
  expect(screen.getByText(/WebView: .*\/$/)).toBeTruthy();
  expect(router.canGoBack()).toBe(false);
});

it('navigates the real WebScreen Stack through its bridge delegate', async () => {
  const rendered = await renderRouter(routes);
  expect(screen.getByText(/WebView: .*\/$/)).toBeTruthy();
  const home = mockWebView.delegate!;
  const push = { path: '/first', operationId: 'push-1' };
  await act(async () => {
    expect(await home.navigationPushV1(push)).toEqual(success({ handled: true }));
    expect(await home.navigationPushV1(push)).toEqual(success({ handled: true }));
  });
  expect(rendered.getSearchParams()).toEqual({ path: '/first' });
  expect(screen.getByText(/WebView: .*\/first$/)).toBeTruthy();
  expect(await home.navigationPushV1({ path: '/stale', operationId: 'stale-1' })).toEqual({
    ok: false,
    error: { code: 'PERMISSION_DENIED' },
  });
  const first = mockWebView.delegate!;
  await act(async () => {
    expect(await first.navigationReplaceV1({ path: '/second', operationId: 'replace-1' })).toEqual(
      success({ handled: true }),
    );
  });
  expect(rendered.getSearchParams()).toEqual({ path: '/second' });
  expect(screen.getByText(/WebView: .*\/second$/)).toBeTruthy();
  expect(
    await mockWebView.delegate!.navigationPushV1({ path: '//evil.test', operationId: 'bad-1' }),
  ).toEqual({
    ok: false,
    error: { code: 'INVALID_REQUEST' },
  });
  expect(rendered.getSearchParams()).toEqual({ path: '/second' });
  await act(async () => {
    expect(await mockWebView.delegate!.navigationBackV1()).toEqual(success({ handled: true }));
  });
  expect(rendered.getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);
});

it.each(['web close', 'native Back'])(
  '%s leaves the next share for the previous screen',
  async (action) => {
    sharing.payloads = [{ shareType: 'url', value: 'https://example.com/first' }];
    const rendered = await renderRouter(routes);
    const home = mockWebView.delegate!;
    await act(async () => {
      expect(
        await home.navigationPushV1({ path: '/share-product', operationId: 'share-open' }),
      ).toEqual(success({ handled: true }));
    });
    expect(rendered.getSearchParams()).toEqual({ path: '/share-product' });
    const save = mockWebView.delegate!;
    sharing.payloads = [{ shareType: 'url', value: 'https://example.com/second' }];
    await act(() => {
      DeviceEventEmitter.emit('appStateDidChange', { app_state: 'active' });
    });
    const first = success({ id: 'share-1', url: 'https://example.com/first' });
    expect(await save.shareReadV1()).toEqual(first);
    if (action === 'web close') {
      expect(await save.shareDismissV1({ id: 'share-1' })).toEqual(success({ done: true }));
      expect(await save.shareReadV1()).toEqual(first);
      await save.shareDismissV1({ id: 'share-2' });
    }
    await act(async () => {
      expect(await save.navigationBackV1()).toEqual(success({ handled: true }));
    });
    expect(rendered.getPathname()).toBe('/');
    expect(await home.shareReadV1()).toEqual(
      success({ id: 'share-2', url: 'https://example.com/second' }),
    );
  },
);

it('returns through the in-app registration history without consuming a queued share', async () => {
  sharing.payloads = [{ shareType: 'url', value: 'https://example.com/shared' }];
  const rendered = await renderRouter(routes);
  const home = mockWebView.delegate!;
  await act(async () => {
    expect(
      await home.navigationPushV1({ path: '/register-product', operationId: 'register' }),
    ).toEqual(success({ handled: true }));
  });
  const registration = mockWebView.delegate!;
  expect(rendered.getSearchParams()).toEqual({ path: '/register-product' });
  await act(async () => {
    await registration.navigationSetWebHistoryV1({ depth: 1 });
    expect(await registration.navigationBackV1()).toEqual(success({ handled: true }));
  });
  expect(rendered.getSearchParams()).toEqual({ path: '/register-product' });
  await act(async () => {
    await registration.navigationSetWebHistoryV1({ depth: 0 });
    expect(await registration.navigationBackV1()).toEqual(success({ handled: true }));
  });
  expect(rendered.getPathname()).toBe('/');
  expect(await home.shareReadV1()).toEqual(
    success({ id: 'share-1', url: 'https://example.com/shared' }),
  );
});

it('refuses an external path supplied through a deep link', async () => {
  await renderRouter(routes, { initialUrl: '/web?path=%2F%2Fevil.test' });
  expect(screen.getByText('Invalid service-relative page path.')).toBeTruthy();
  expect(mockWebView.delegate).toBeNull();
});
