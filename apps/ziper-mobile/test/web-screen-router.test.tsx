import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Platform } from 'react-native';
import { afterEach, expect, it, vi } from 'vitest';
import { success } from '@ziper/bridge/contract';
import type { BridgeDelegate } from '@webview-bridge/react-native';
import type { NativeBridge } from '@ziper/bridge/native';
import RootLayout from '../src/app/_layout';
import HomeRoute from '../src/app/index';
import WebRoute from '../src/app/web';

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

const routes = { _layout: RootLayout, index: HomeRoute, web: WebRoute };

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

it('refuses an external path supplied through a deep link', async () => {
  await renderRouter(routes, { initialUrl: '/web?path=%2F%2Fevil.test' });
  expect(screen.getByText('Invalid service-relative page path.')).toBeTruthy();
  expect(mockWebView.delegate).toBeNull();
});
