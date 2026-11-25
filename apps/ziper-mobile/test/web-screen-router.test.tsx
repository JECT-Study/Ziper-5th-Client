import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { DeviceEventEmitter, Linking, Platform } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { fireEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { capability, productExtractionTimeout, success } from '@ziper/bridge/contract';
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
const mockExtraction = vi.hoisted(() => ({
  props: undefined as import('react-native-webview').WebViewProps | undefined,
  instance: undefined as symbol | undefined,
  injectJavaScript: vi.fn(),
}));
vi.mock('react-native-webview', async () => {
  const { useImperativeHandle, useState } = await import('react');
  const { Text } = await import('react-native');
  return {
    WebView: ({
      ref,
      ...props
    }: import('react-native-webview').WebViewProps & {
      ref?: import('react').Ref<{ injectJavaScript: (script: string) => void }>;
    }) => {
      const [instance] = useState(() => Symbol());
      mockExtraction.instance = instance;
      mockExtraction.props = props;
      useImperativeHandle(ref, () => ({ injectJavaScript: mockExtraction.injectJavaScript }), []);
      return <Text>Product extractor</Text>;
    },
  };
});

const mockSheet = vi.hoisted(() => ({ onDismiss: undefined as (() => void) | undefined }));
vi.mock('@expo/ui', () => ({
  BottomSheet: ({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) => {
    mockSheet.onDismiss = onDismiss;
    return children;
  },
  RNHostView: ({ children }: { children: ReactNode }) => children,
}));

const routes = {
  _layout: RootLayout,
  index: HomeRoute,
  web: WebRoute,
  '+native-intent': { redirectSystemPath },
};

it.each([
  ['/products/1?preview=normal', 24],
  ['/register-product?step=details', 0],
  ['/share-product', 0],
  ['/', 24],
] as const)('preserves the top safe area for %s', async (path, paddingTop) => {
  const insets = vi
    .spyOn(SafeArea, 'useSafeAreaInsets')
    .mockReturnValue({ top: 24, bottom: 0, left: 0, right: 0 });
  try {
    await renderRouter(routes, { initialUrl: '/web?path=' + encodeURIComponent(path) });
    // Android WebView 는 env(safe-area-inset-top) 을 스스로 주므로 네이티브 여백을 두지 않는다.
    expect(screen.getByText(/^WebView:/).parent?.props.style).toMatchObject({
      paddingTop: Platform.OS === 'android' ? 0 : paddingTop,
    });
  } finally {
    insets.mockRestore();
  }
});

it('opens an external product through the real screen delegate without navigating its WebView', async () => {
  const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const rendered = await renderRouter(routes);
  const page = mockWebView.delegate!;
  const input = { url: 'https://shop.example/item', operationId: 'original-1' };
  await act(async () => {
    expect(await page.externalOpenV1(input)).toEqual(success({ done: true }));
  });
  expect(open).toHaveBeenCalledExactlyOnceWith(input.url);
  expect(rendered.getPathname()).toBe('/');
  open.mockRestore();
});
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

it.each([
  'timeout',
  'partial regresses',
  'price changes',
  'name changes',
  'query changes',
  'blocked',
  'Ably',
  'late partial after redirect metadata',
  'invalid message after redirect metadata',
  'competing option before redirect URL',
  'partial for the same pending address',
  'changed price for the same pending address',
  'short',
  'legacy',
] as const)('extracts: %s', async (reason) => {
  await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
  const page = mockWebView.delegate!;
  expect(await page.getBridgeInfoV1()).toMatchObject({
    value: { capabilities: expect.arrayContaining([capability.productExtraction]) },
  });
  vi.useFakeTimers();
  const url = 'https://m.a-bly.com/goods/7';
  const redirected = 'https://mobile.a-bly.com/goods/7';
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/sample.jpg';
  const inputURL =
    reason === 'legacy'
      ? 'http://m.a-bly.com/goods/%37'
      : reason === 'short'
        ? 'https://applink.a-bly.com/69ptirx'
        : url;
  let result: ReturnType<typeof page.extractProductV1> | undefined;
  await act(() => {
    result = page.extractProductV1({
      url: inputURL,
      shops: [
        {
          hosts: ['m.a-bly.com'],
          fields: { title: ['title'], price: [], image: [] },
          imageHosts: ['d3ha2047wt6x28.cloudfront.net'],
          imageStrategy: 'SERVER_MIRROR',
        },
      ],
    });
  });
  expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
  const props = mockExtraction.props!;
  expect(props.source).toEqual({ uri: reason === 'legacy' ? url : inputURL });
  expect(
    props.onShouldStartLoadWithRequest?.({
      url: 'http://m.a-bly.com/goods/7',
      isTopFrame: false,
    } as never),
  ).toBe(false);
  expect(props).not.toHaveProperty('delegate');
  expect(props.onShouldStartLoadWithRequest?.({ url: 'https://app.ziper.cc' } as never)).toBe(
    false,
  );
  const partial = { url, name: '가디건', price: null, imageURL: null };
  const full = { ...partial, price: 39_000, imageURL };
  const priced = { ...partial, price: 0 };
  const renamed = { ...partial, name: '다른 이름' };
  const send = (metadata: {
    url: string;
    name: string;
    price: number | null;
    imageURL: string | null;
  }) =>
    props.onMessage?.({
      nativeEvent: { url: metadata.url, data: JSON.stringify(metadata) },
    } as never);
  await act(() => {
    if (reason === 'short') {
      expect(props.onShouldStartLoadWithRequest?.({ url } as never)).toBe(true);
      expect(
        props.onShouldStartLoadWithRequest?.({
          url: 'https://www.musinsa.com/products/7',
        } as never),
      ).toBe(false);
      expect(
        props.onShouldStartLoadWithRequest?.({ url: 'https://m.a-bly.com/events/7' } as never),
      ).toBe(false);
      props.onLoadStart?.({ nativeEvent: { url } } as never);
      // A recommendation from the same shop is not the resolved product.
      expect(props.onShouldStartLoadWithRequest?.({ url: url.replace(/\d+$/, '8') } as never)).toBe(
        false,
      );
      expect(props.onShouldStartLoadWithRequest?.({ url: redirected } as never)).toBe(true);
    }
    for (const progress of [0.2, 0.4, 0.6]) {
      props.onLoadProgress?.({ nativeEvent: { url, progress } } as never);
    }
    expect(mockExtraction.injectJavaScript).toHaveBeenCalledExactlyOnceWith(
      props.injectedJavaScriptBeforeContentLoaded,
    );
    send(partial);
    if (reason === 'timeout') vi.advanceTimersByTime(productExtractionTimeout);
    else if (
      reason === 'partial regresses' ||
      reason === 'price changes' ||
      reason === 'name changes' ||
      reason === 'query changes'
    ) {
      send(priced);
      if (reason === 'query changes') {
        props.onLoadStart?.({ nativeEvent: { url: url + '?option=8' } } as never);
      } else if (reason === 'price changes') {
        send({ ...priced, price: 39_000 });
      } else if (reason === 'name changes') {
        send(renamed);
      } else {
        props.onLoadStart?.({ nativeEvent: { url: url + '#reviews' } } as never);
        send({ ...partial, url: url + '#reviews' });
      }
      vi.advanceTimersByTime(productExtractionTimeout);
    } else if (reason === 'blocked') {
      props.onLoad?.({ nativeEvent: { url: 'https://example.org/product' } } as never);
    } else {
      const message = {
        nativeEvent: { url: redirected, data: JSON.stringify({ ...full, url: redirected }) },
      };
      // Before Android reports the redirect, the source URL must not be trusted.
      props.onMessage?.(message as never);
      expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
      if (reason === 'late partial after redirect metadata') send(partial);
      if (reason === 'invalid message after redirect metadata') {
        props.onMessage?.({ nativeEvent: { ...message.nativeEvent, data: '{' } } as never);
        send({ ...full, url: redirected.replace('/7', '/8') });
      }
      if (reason === 'competing option before redirect URL') {
        send({ ...full, url: redirected + '?option=8', price: 18_000 });
        props.onLoad?.({ nativeEvent: { url: url + '#reviews' } } as never);
        props.onLoad?.({ nativeEvent: { url: url + '?utm_source=share' } } as never);
      }
      if (reason === 'partial for the same pending address')
        send({ ...full, url: redirected, imageURL: null });
      if (reason === 'changed price for the same pending address')
        send({ ...full, url: redirected, price: 18_000, imageURL: null });
      props.onLoad?.({ nativeEvent: { url: redirected + '#details' } } as never);
      vi.advanceTimersByTime(productExtractionTimeout);
    }
  });
  const expected = {
    timeout: partial,
    'partial regresses': priced,
    'price changes': { ...priced, price: 39_000 },
    'name changes': renamed,
    'query changes': null,
    blocked: null,
    Ably: full,
    'late partial after redirect metadata': full,
    'invalid message after redirect metadata': full,
    'competing option before redirect URL': full,
    'partial for the same pending address': full,
    'changed price for the same pending address': { ...full, price: 18_000, imageURL: null },
    short: full,
    legacy: full,
  };
  await expect(result).resolves.toEqual(success(expected[reason]));
  expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
});

it.each(['Zigzag', 'Ably'])(
  'extracts a %s short link from the canonical product page',
  async (shop) => {
    await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
    const page = mockWebView.delegate!;
    const zigzag = shop === 'Zigzag';
    const share = zigzag ? 'https://s.zigzag.kr/abr/x' : 'https://applink.a-bly.com/69ptirx';
    const landing = 'https://zigzag.kr/bridges/creator-lounge/pdp?product_id=169420901';
    const deeplink = `zigzag://open/full_screen_simple_browser?product_id=169420901&url=${encodeURIComponent(landing)}`;
    const intermediate = zigzag
      ? `https://abr.ge/@zigzag/affiliate?deeplink_url=${encodeURIComponent(deeplink)}`
      : 'https://ably.airbridge.io/goods/51978009';
    const url = zigzag
      ? 'https://zigzag.kr/catalog/products/169420901'
      : 'https://m.a-bly.com/goods/51978009';
    const imageURL = zigzag
      ? 'https://cf.product-image.s.zigzag.kr/sample.jpg'
      : 'https://d3ha2047wt6x28.cloudfront.net/sample.jpg';
    let result: ReturnType<typeof page.extractProductV1> | undefined;
    await act(() => {
      result = page.extractProductV1({
        url: share,
        shops: [
          {
            hosts: [new URL(url).hostname],
            fields: { title: ['title'], price: [], image: [] },
            imageHosts: [new URL(imageURL).hostname],
            imageStrategy: 'SERVER_MIRROR',
          },
        ],
      });
    });
    const props = mockExtraction.props!;
    expect(props.source).toEqual({ uri: share });
    for (const [target, allowed] of [
      [`${landing}&product_id=2`, false],
      ['https://ably.airbridge.io/webview', false],
      [
        zigzag
          ? intermediate.replace('@zigzag', '@other')
          : intermediate.replace('ably.', 'other.'),
        false,
      ],
      [
        zigzag
          ? intermediate.replace('zigzag.kr', 'zigzag.kr.example.org')
          : intermediate.replace('/goods/', '/event/'),
        false,
      ],
      [
        zigzag ? intermediate.replace('169420901', '2') : intermediate.replace('https:', 'http:'),
        false,
      ],
      ['https://www.musinsa.com/products/7', false],
    ] as const) {
      expect(props.onShouldStartLoadWithRequest?.({ url: target } as never)).toBe(allowed);
    }
    await act(() => {
      expect(
        props.onShouldStartLoadWithRequest?.({ url: intermediate, isTopFrame: true } as never),
      ).toBe(false);
      props.onLoad?.({
        nativeEvent: { url: 'https://zigzag.airbridge.io/open/full_screen_simple_browser' },
      } as never);
    });
    expect(mockExtraction.props!.source).toEqual({ uri: url });
    expect(
      mockExtraction.props!.onShouldStartLoadWithRequest?.({
        url: url.replace(/\d+$/, '2'),
      } as never),
    ).toBe(false);
    const product = { url, name: '크리시 비조 절개 팬츠', price: 35_690, imageURL };
    await act(() => {
      mockExtraction.props!.onMessage?.({
        nativeEvent: { url, data: JSON.stringify(product) },
      } as never);
    });
    await expect(result).resolves.toEqual(success(product));
  },
);

it.each(['slow product', 'never resolves', 'deadline', 'denied'])(
  'bounds the short-link product window: %s',
  async (scenario) => {
    await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
    vi.useFakeTimers();
    const page = mockWebView.delegate!;
    const url = 'https://www.musinsa.com/products/4804589';
    const share = 'https://musinsa.onelink.me/PvkC/z4ndikzs';
    const imageURL = 'https://image.msscdn.net/sample.jpg';
    const product = { url, name: '지퍼 압축 파우치', price: 24_490, imageURL };
    let result: ReturnType<typeof page.extractProductV1> | undefined;
    await act(() => {
      result = page.extractProductV1({
        url: share,
        shops: [
          {
            hosts: ['www.musinsa.com'],
            fields: { title: ['title'], price: [], image: [] },
            imageHosts: ['image.msscdn.net'],
            imageStrategy: 'SERVER_MIRROR',
          },
        ],
      });
    });
    const props = mockExtraction.props!;
    await act(() => {
      vi.advanceTimersByTime(7_000);
      if (scenario === 'never resolves') {
        props.onLoad?.({ nativeEvent: { url: share } } as never);
        vi.advanceTimersByTime(1_000);
        return;
      }
      props.onLoadStart?.({ nativeEvent: { url } } as never);
      if (scenario === 'denied')
        props.onHttpError?.({ nativeEvent: { url, statusCode: 403 } } as never);
      else vi.advanceTimersByTime(3_000);
    });
    if (scenario === 'slow product' || scenario === 'deadline') {
      expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
      await act(() => {
        if (scenario === 'slow product') {
          props.onMessage?.({ nativeEvent: { url, data: JSON.stringify(product) } } as never);
        } else {
          props.onLoad?.({ nativeEvent: { url: url + '?option=1' } } as never);
          vi.advanceTimersByTime(2_000);
        }
      });
    }
    expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
    await expect(result).resolves.toEqual(success(scenario === 'slow product' ? product : null));
  },
);

it.each([
  'late product',
  'resolved short link',
  'resolved short gateway',
  'resolved short deadline',
  'late history',
  'early history',
  'progress only',
  'deadline',
  'early load',
  'no load',
  'different product',
  'denied',
  'late gateway',
])('only gives a late Ably product load time to settle: %s', async (scenario) => {
  await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
  vi.useFakeTimers();
  const page = mockWebView.delegate!;
  const url = 'https://m.a-bly.com/goods/3798513';
  const destination = url.replace('m.a-bly.com', 'mobile.a-bly.com');
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/sample.jpg';
  const product = { url, name: '투명파우치', price: 4_650, imageURL };
  const short = scenario.startsWith('resolved short');
  let result: ReturnType<typeof page.extractProductV1> | undefined;
  await act(() => {
    result = page.extractProductV1({
      url: short ? 'https://applink.a-bly.com/8uwnjcs' : url,
      shops: [
        {
          hosts: ['m.a-bly.com'],
          fields: { title: ['title'], price: [], image: [] },
          imageHosts: [new URL(imageURL).hostname],
          imageStrategy: 'SERVER_MIRROR',
        },
      ],
    });
  });
  const props = mockExtraction.props!;
  const load = (url: string) => props.onLoad?.({ nativeEvent: { url } } as never);
  const recovers =
    scenario === 'late product' ||
    scenario === 'resolved short link' ||
    (scenario === 'late history' && Platform.OS === 'android');
  await act(() => {
    const elapsed = scenario.startsWith('early')
      ? 2_000
      : scenario === 'late product'
        ? 5_600
        : 7_200;
    if (short) {
      vi.advanceTimersByTime(800);
      props.onLoadStart?.({ nativeEvent: { url } } as never);
    }
    vi.advanceTimersByTime(elapsed - (short ? 800 : 0));
    if (scenario.endsWith('history'))
      props.onLoadStart?.({ nativeEvent: { url: destination } } as never);
    else if (scenario === 'progress only')
      props.onLoadProgress?.({ nativeEvent: { url: destination, progress: 0.8 } } as never);
    else if (scenario !== 'no load')
      load(scenario === 'different product' ? destination.replace('3798513', '7') : destination);
    if (
      scenario === 'denied' ||
      scenario === 'late gateway' ||
      scenario === 'resolved short gateway'
    )
      props.onHttpError?.({
        nativeEvent: { url: destination, statusCode: scenario === 'denied' ? 403 : 502 },
      } as never);
    vi.advanceTimersByTime(8_000 - elapsed);
  });
  if (recovers || scenario.endsWith('deadline')) {
    expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
    if (recovers) {
      await act(() => {
        vi.advanceTimersByTime(3_650);
        props.onMessage?.({
          nativeEvent: {
            url: destination,
            data: JSON.stringify({ ...product, url: destination }),
          },
        } as never);
      });
    } else {
      await act(() => {
        vi.advanceTimersByTime(3_999);
        load(destination);
      });
      expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
      await act(() => vi.advanceTimersByTime(1));
    }
  }
  expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
  await expect(result).resolves.toEqual(success(recovers ? product : null));
});

it.each(['redirect', 'alias redirect', 'gateway', 'no redirect'])(
  'does not read, retry or extend an Ably offer landing page: %s',
  async (scenario) => {
    await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
    vi.useFakeTimers();
    const canonical = 'https://m.a-bly.com/goods/5462175';
    const offer =
      scenario === 'alias redirect'
        ? 'https://www.a-bly.com/app/goods/%35462175?coupon_sno=44495066'
        : 'https://a-bly.com/app/goods/5462175?coupon_sno=44495066';
    const destination = 'https://mobile.a-bly.com/goods/5462175?coupon_sno=44495066';
    const product = { name: '텀블러', price: 22_500, imageURL: 'https://cdn.example.com/item.jpg' };
    const page = mockWebView.delegate!;
    let result: ReturnType<typeof page.extractProductV1> | undefined;
    await act(() => {
      result = page.extractProductV1({
        url: offer,
        shops: [
          {
            hosts: ['a-bly.com', 'm.a-bly.com'],
            fields: { title: ['title'], price: [], image: [] },
            imageHosts: ['cdn.example.com'],
            imageStrategy: 'SERVER_MIRROR',
          },
        ],
      });
    });
    const props = mockExtraction.props!;
    expect(props.source).toEqual({ uri: offer });
    await act(() => {
      vi.advanceTimersByTime(5_500);
      props.onLoad?.({ nativeEvent: { url: offer } } as never);
      props.onMessage?.({
        nativeEvent: {
          url: offer,
          data: JSON.stringify({ ...product, url: offer, price: 25_000 }),
        },
      } as never);
    });
    expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
    await act(() => {
      if (scenario === 'gateway')
        props.onHttpError?.({ nativeEvent: { url: offer, statusCode: 502 } } as never);
      else if (scenario === 'no redirect') vi.advanceTimersByTime(2_500);
      else {
        const start = props.onShouldStartLoadWithRequest!;
        expect(start({ url: destination.replace('5462175', '1') } as never)).toBe(false);
        expect(start({ url: destination } as never)).toBe(true);
        props.onLoadStart?.({ nativeEvent: { url: destination } } as never);
        props.onMessage?.({
          nativeEvent: { url: destination, data: JSON.stringify({ ...product, url: destination }) },
        } as never);
      }
    });
    expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
    await expect(result).resolves.toEqual(
      success(
        scenario === 'redirect' || scenario === 'alias redirect'
          ? { ...product, url: canonical }
          : null,
      ),
    );
  },
);

it.each(['HTTPS redirect', 'stalled redirect', 'early injection'])(
  'extracts Musinsa OneLink after %s',
  async (scenario) => {
    const redirects = scenario !== 'stalled redirect';
    await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
    vi.useFakeTimers();
    const page = mockWebView.delegate!;
    const share = 'https://musinsa.onelink.me/PvkC/z4ndikzs';
    const url = 'https://www.musinsa.com/products/4804589';
    const imageURL = 'https://image.msscdn.net/sample.jpg';
    let result: ReturnType<typeof page.extractProductV1> | undefined;
    await act(() => {
      result = page.extractProductV1({
        url: share,
        shops: [
          {
            hosts: ['www.musinsa.com'],
            fields: { title: ['title'], price: [], image: [] },
            imageHosts: ['image.msscdn.net'],
            imageStrategy: 'SERVER_MIRROR',
          },
        ],
      });
    });
    const start = mockExtraction.props!.onShouldStartLoadWithRequest!;
    await act(() => {
      expect(start({ url: `musinsaad://web?link=${encodeURIComponent(url)}` } as never)).toBe(
        false,
      );
      vi.advanceTimersByTime(1_000);
      expect(mockExtraction.props!.source).toEqual({ uri: share });
      if (redirects) expect(start({ url } as never)).toBe(true);
      vi.advanceTimersByTime(1_500);
    });
    expect(mockExtraction.props!.source).toEqual({ uri: redirects ? share : url });
    const product = { url, name: '무신사 스탠다드', price: 24_490, imageURL };
    const props = mockExtraction.props!;
    await act(() => {
      for (const candidate of [
        share,
        'https://www.musinsa.com/account',
        'https://m.a-bly.com/goods/1',
      ]) {
        props.onLoadProgress?.({ nativeEvent: { url: candidate, progress: 0.5 } } as never);
      }
      expect(mockExtraction.injectJavaScript).not.toHaveBeenCalled();
      for (const progress of [0.4, 0.7]) {
        props.onLoadProgress?.({ nativeEvent: { url, progress } } as never);
      }
      expect(mockExtraction.injectJavaScript).toHaveBeenCalledExactlyOnceWith(
        props.injectedJavaScript,
      );
      if (scenario === 'early injection') {
        // Progress fired while the old short-link document was still active.
        // The product document can become readable before load finish (which may stall).
        props.onLoadStart?.({ nativeEvent: { url } } as never);
        props.onLoadStart?.({ nativeEvent: { url } } as never);
        expect(mockExtraction.injectJavaScript).toHaveBeenCalledTimes(2);
      }
      props.onMessage?.({ nativeEvent: { url, data: JSON.stringify(product) } } as never);
      if (scenario === 'HTTPS redirect') {
        expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
        props.onLoad?.({ nativeEvent: { url } } as never);
      }
    });
    await expect(result).resolves.toEqual(success(product));
  },
);

it.each([
  'recovered',
  'reset twice',
  'http denial',
  'gateway 502 recovered',
  'gateway 504 recovered',
  'gateway 502 twice',
  'gateway 502 unresolved short link',
  'gateway 504 confirmed short link recovered',
  'gateway 502 wrong product',
  'gateway 504 at deadline',
  'http 429',
  'http 503',
  'certificate error',
  'short link',
  'late reset',
  'renderer recovered',
  'renderer gone twice',
  'renderer gone at short link',
  'renderer gone at deadline',
])('handles a product-page load failure: %s', async (outcome) => {
  await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
  vi.useFakeTimers();
  const page = mockWebView.delegate!;
  const url = 'https://www.musinsa.com/products/4804589';
  const imageURL = 'https://image.msscdn.net/sample.jpg';
  const product = { url, name: '지퍼 압축 파우치', price: 24_490, imageURL };
  const inputURL = outcome.includes('short link')
    ? 'https://musinsa.onelink.me/PvkC/z4ndikzs'
    : url;
  const confirmedShortLink = outcome.includes('confirmed short link');
  const renderer = outcome.startsWith('renderer');
  const recovered = outcome === 'recovered' || outcome.endsWith(' recovered');
  const status = /\b(\d{3})\b/.exec(outcome)?.[1];
  const httpStatus = status ? Number(status) : outcome === 'http denial' ? 403 : null;
  const ios = Platform.OS === 'ios';
  const reset = {
    nativeEvent: {
      // WKWebView reports an empty current URL on provisional load failure.
      url: ios ? '' : inputURL,
      code: ios ? -1005 : -6,
      domain: ios ? 'NSURLErrorDomain' : undefined,
    },
  } as never;
  const message = { nativeEvent: { url, data: JSON.stringify(product) } } as never;
  let result: ReturnType<typeof page.extractProductV1> | undefined;
  await act(() => {
    result = page.extractProductV1({
      url: inputURL,
      shops: [
        {
          hosts: ['www.musinsa.com'],
          fields: { title: ['title'], price: [], image: [] },
          imageHosts: ['image.msscdn.net'],
          imageStrategy: 'SERVER_MIRROR',
        },
      ],
    });
  });
  const fail = (props: NonNullable<typeof mockExtraction.props>) => {
    if (httpStatus) {
      const failedURL = outcome.endsWith('wrong product')
        ? url.replace('4804589', '6623590')
        : confirmedShortLink
          ? url
          : inputURL;
      return props.onHttpError?.({
        nativeEvent: { url: failedURL, statusCode: httpStatus },
      } as never);
    }
    if (!renderer) return props.onError?.(reset);
    if (ios) props.onContentProcessDidTerminate?.({ nativeEvent: { url: '' } } as never);
    else props.onRenderProcessGone?.({ nativeEvent: { didCrash: true, url: '' } } as never);
  };
  const first = mockExtraction.props!;
  const instance = mockExtraction.instance;
  await act(() => {
    if (confirmedShortLink) first.onLoad?.({ nativeEvent: { url } } as never);
    if (outcome === 'certificate error') {
      first.onError?.({ nativeEvent: { url, code: ios ? -1202 : -11 } } as never);
    } else {
      if (outcome === 'late reset' || outcome.endsWith('at deadline'))
        vi.advanceTimersByTime(productExtractionTimeout - 1);
      fail(first);
    }
  });
  if (recovered || outcome.endsWith(' twice')) {
    const retry = mockExtraction.props!;
    expect(mockExtraction.instance).not.toBe(instance);
    expect(retry.source).toEqual({ uri: url });
    await act(() => {
      // A late event from the old view must not end the replacement attempt.
      fail(first);
      first.onMessage?.(message);
    });
    expect(screen.getByText('Product extractor', { includeHiddenElements: true })).toBeTruthy();
    await act(() => {
      if (recovered) retry.onMessage?.(message);
      else fail(retry);
    });
  }
  expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
  await expect(result).resolves.toEqual(success(recovered ? product : null));
});

it.each(['same URL', 'different URL'])('replaces an abandoned extraction: %s', async (kind) => {
  await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
  vi.useFakeTimers();
  const page = mockWebView.delegate!;
  const url = 'https://www.musinsa.com/products/4804589';
  const latestURL = kind === 'same URL' ? url : 'https://www.musinsa.com/products/6623590';
  const input = {
    url,
    shops: [
      {
        hosts: ['www.musinsa.com'],
        fields: { title: ['title'], price: [], image: [] },
        imageHosts: ['image.msscdn.net'],
        imageStrategy: 'SERVER_MIRROR' as const,
      },
    ],
  };
  let old: ReturnType<typeof page.extractProductV1> | undefined;
  let latest: ReturnType<typeof page.extractProductV1> | undefined;
  await act(() => {
    old = page.extractProductV1(input);
  });
  const abandoned = mockExtraction.props!;
  const previousInstance = mockExtraction.instance;
  const product = {
    url: latestURL,
    name: '선택한 상품',
    price: 24_490,
    imageURL: 'https://image.msscdn.net/new.jpg',
  };
  const send = (props: typeof abandoned, metadata: typeof product) =>
    props.onMessage?.({
      nativeEvent: { url: metadata.url, data: JSON.stringify(metadata) },
    } as never);
  await act(() => {
    latest = page.extractProductV1({ ...input, url: latestURL });
    // The cancelled view can still have events waiting in the native queue.
    send(abandoned, { ...product, url, name: '이전 결과' });
    abandoned.onHttpError?.({ nativeEvent: { url, statusCode: 403 } } as never);
  });
  expect(mockExtraction.props!.source).toEqual({ uri: latestURL });
  expect(mockExtraction.instance).not.toBe(previousInstance);
  await act(() => send(mockExtraction.props!, product));
  await expect(old).resolves.toEqual(success(null));
  await expect(latest).resolves.toEqual(success(product));
});

it('rejects a main-frame HTTP error on a redirect before the page URL updates', async () => {
  await renderRouter(routes, { initialUrl: '/web?path=%2Fregister-product' });
  vi.useFakeTimers();
  const page = mockWebView.delegate!;
  const url = 'https://m.a-bly.com/goods/7';
  const redirected = 'https://mobile.a-bly.com/goods/7';
  let result: ReturnType<typeof page.extractProductV1> | undefined;
  await act(() => {
    result = page.extractProductV1({
      url,
      shops: [
        {
          hosts: ['m.a-bly.com'],
          fields: { title: ['title'], price: [], image: [] },
          imageHosts: ['d3ha2047wt6x28.cloudfront.net'],
          imageStrategy: 'SERVER_MIRROR',
        },
      ],
    });
  });
  const props = mockExtraction.props!;
  await act(() => {
    props.onHttpError?.({ nativeEvent: { url: redirected, statusCode: 403 } } as never);
    props.onLoad?.({ nativeEvent: { url: redirected } } as never);
    props.onMessage?.({
      nativeEvent: {
        url: redirected,
        data: JSON.stringify({
          url: redirected,
          name: '접근 거부 응답의 상품 태그',
          price: 20_000,
          imageURL: 'https://d3ha2047wt6x28.cloudfront.net/sample.jpg',
        }),
      },
    } as never);
  });
  await expect(result).resolves.toEqual(success(null));
  expect(screen.queryByText('Product extractor', { includeHiddenElements: true })).toBeNull();
});

afterEach(() => {
  mockExtraction.props = undefined;
  mockExtraction.instance = undefined;
  mockExtraction.injectJavaScript.mockClear();
  mockWebView.delegate = null;
  mockSheet.onDismiss = undefined;
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

it('returns home when registration is the first native screen', async () => {
  const rendered = await renderRouter(routes, {
    initialUrl: '/web?path=%2Fregister-product%3Fstep%3Ddetails',
  });
  expect(rendered.getSearchParams()).toEqual({ path: '/register-product?step=details' });
  await act(async () => {
    expect(await mockWebView.delegate!.navigationBackV1()).toEqual(success({ handled: true }));
  });
  expect(rendered.getPathname()).toBe('/');
});

const sheet = {
  title: '작업 선택',
  operationId: 'first',
  actions: [{ id: 'save', label: '저장' }],
};

it('opens a native sheet through the production delegate and ignores an obsolete dismiss event', async () => {
  await renderRouter(routes);
  const page = mockWebView.delegate!;
  let first!: ReturnType<typeof page.sheetActionsV1>;
  await act(async () => {
    first = page.sheetActionsV1(sheet);
  });
  expect(screen.getByRole('header', { name: '작업 선택' })).toBeTruthy();
  const oldDismiss = mockSheet.onDismiss!;
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await expect(first).resolves.toEqual(success({ status: 'selected', actionId: 'save' }));

  let second!: typeof first;
  await act(async () => {
    second = page.sheetActionsV1({ ...sheet, operationId: 'second' });
  });
  await act(() => oldDismiss());
  expect(screen.getByRole('header', { name: '작업 선택' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '취소' }));
  await expect(second).resolves.toEqual(success({ status: 'cancelled' }));
  expect(screen.queryByRole('header', { name: '작업 선택' })).toBeNull();
});

it.each(['sheet dismiss', 'bridge back', 'route blur'] as const)(
  'cancels the native sheet on %s',
  async (mode) => {
    const rendered = await renderRouter(routes);
    await act(() => router.push({ pathname: '/web', params: { path: '/design-system' } }));
    const page = mockWebView.delegate!;
    let result!: ReturnType<typeof page.sheetActionsV1>;
    await act(async () => {
      result = page.sheetActionsV1(sheet);
    });
    if (mode === 'sheet dismiss') {
      await act(() => mockSheet.onDismiss?.());
    } else if (mode === 'bridge back') {
      await act(async () => {
        expect(await page.navigationBackV1()).toEqual(success({ handled: true }));
      });
      expect(rendered.getSearchParams()).toEqual({ path: '/design-system' });
    } else {
      await act(() => router.push({ pathname: '/web', params: { path: '/other' } }));
      expect(rendered.getSearchParams()).toEqual({ path: '/other' });
    }
    await expect(result).resolves.toEqual(success({ status: 'cancelled' }));
    expect(screen.queryByText('작업 선택')).toBeNull();
  },
);

it('refuses an external path supplied through a deep link', async () => {
  await renderRouter(routes, { initialUrl: '/web?path=%2F%2Fevil.test' });
  expect(screen.getByText('잘못된 화면 주소예요.')).toBeTruthy();
  expect(mockWebView.delegate).toBeNull();
});
