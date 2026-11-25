// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { isProductExtractionURL } from './link';
import { readProductMessage } from './message';
import { productScanScript } from './scanner/index';
import type { Shops } from './schema';

const shops: Shops = [
  {
    hosts: ['www.musinsa.com'],
    imageHosts: ['image.msscdn.net'],
    imageStrategy: 'SERVER_MIRROR',
    fields: {
      title: ['ldjson:name'],
      price: ['json:__NEXT_DATA__.price'],
      image: ['ldjson:image[0]'],
    },
  },
];
const finalUrl = 'https://www.musinsa.com/products/7';
const shortUrl = 'https://musinsa.onelink.me/sample';
const imageURL = 'https://image.msscdn.net/card.png';
const extracted = { url: finalUrl, name: '가디건', price: 39000, imageURL };
afterEach(() => {
  vi.useRealTimers();
});

it('extracts metadata from the final shop and accepts only bounded, related messages', () => {
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML =
    '<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"가디건","image":["' +
    imageURL +
    '"]}]}</script>' +
    '<script id="__NEXT_DATA__">{"price":"39,000원"}</script>';
  const postMessage = vi.fn<(data: string) => void>();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript(shops))(
    view,
    new URL(finalUrl),
    page,
  );
  const data = postMessage.mock.calls[0]![0];
  expect(
    readProductMessage(data, { origin: 'https://www.musinsa.com', pageURL: finalUrl, shops }),
  ).toEqual({
    documentURL: finalUrl,
    metadata: extracted,
    complete: true,
  });
  expect(
    readProductMessage(data, { origin: 'https://cdn.example', pageURL: finalUrl, shops }),
  ).toBeNull();
  expect(
    readProductMessage(data, {
      origin: finalUrl,
      pageURL: 'https://www.musinsa.com/products/8',
      shops,
    }),
  ).toBeNull();
  expect(isProductExtractionURL(shortUrl, true)).toBe(true);
  expect(isProductExtractionURL('https://www.musinsa.com.example.org/item', true)).toBe(false);
});

it.each([
  ['가'.repeat(199) + '🍑', true],
  ['🍑'.repeat(200), true],
  ['가'.repeat(201), true], // The form must show the full name for editing, not a clipped prefix.
  ['가'.repeat(401), false],
])('does not truncate a storefront title at a UTF-16 boundary (%#)', (name, fitsBridge) => {
  vi.useFakeTimers();
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    sku: '7',
    name,
    image: [imageURL],
  })}</script><script id="__NEXT_DATA__">{"price":39000}</script>`;
  const postMessage = vi.fn<(data: string) => void>();
  const view = {
    get top() {
      return this;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript(shops))(
    view,
    new URL(finalUrl),
    page,
  );
  expect(
    readProductMessage(postMessage.mock.calls[0]![0], {
      origin: finalUrl,
      pageURL: finalUrl,
      shops,
    }),
  ).toEqual({
    documentURL: finalUrl,
    metadata: { ...extracted, name: fitsBridge ? name : '' },
    complete: fitsBridge,
  });
});

it('accepts metadata after a same-document fragment change, but not after a query change', () => {
  const pageURL = `${finalUrl}?option=7#reviews`;
  const frameURL = `${finalUrl}?option=7`;
  const payload = (url: string) => JSON.stringify({ ...extracted, url });
  expect(
    readProductMessage(payload(`${frameURL}#details`), {
      origin: frameURL,
      pageURL: pageURL,
      shops,
    }),
  ).toEqual({
    documentURL: frameURL,
    metadata: extracted,
    complete: true,
  });
  const otherOption = `${finalUrl}?option=8#reviews`;
  expect(
    readProductMessage(payload(otherOption), { origin: frameURL, pageURL: pageURL, shops }),
  ).toBeNull();
  expect(
    readProductMessage(payload(frameURL), { origin: otherOption, pageURL: pageURL, shops }),
  ).toBeNull();
});

it('scans one document and resends late metadata while native commits a redirect', () => {
  vi.useFakeTimers();
  const page = document.implementation.createHTMLDocument();
  const postMessage = vi.fn();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  const run = new Function('window', 'location', 'document', productScanScript(shops));
  run(view, new URL(finalUrl), page);
  expect(postMessage).not.toHaveBeenCalled();

  page.head.innerHTML =
    '<script type="application/ld+json">' +
    JSON.stringify({
      '@type': 'Product',
      name: extracted.name,
      image: [imageURL],
    }) +
    '</script><script id="__NEXT_DATA__">{"price":39000}</script>';
  // Android can run both its progress fallback and the normal load-finish script.
  run(view, new URL(finalUrl), page);
  vi.advanceTimersByTime(300);
  expect(postMessage).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
  vi.advanceTimersByTime(8000);
  expect(postMessage.mock.calls).toEqual(
    Array.from({ length: 3 }, () => [JSON.stringify(extracted)]),
  );
});

it('keeps the same Ably product across the observed redirect but rejects a different product', () => {
  const canonical = 'https://m.a-bly.com/goods/13519743';
  const redirected = 'https://mobile.a-bly.com/goods/13519743';
  vi.useFakeTimers();
  const ablyImage = 'https://d3ha2047wt6x28.cloudfront.net/sample.png';
  const ablyRules = [
    {
      ...shops[0]!,
      hosts: ['m.a-bly.com'],
      imageHosts: [new URL(ablyImage).hostname],
      fields: { ...shops[0]!.fields, price: ['ldjson:offers.price'] },
    },
  ];
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML = `
    <script type="application/ld+json">{"@type":"Product","sku":"13519743","name":"가디건","image":["${ablyImage}"],"offers":{"price":39000,"priceCurrency":"KRW"}}</script>`;
  const postMessage = vi.fn<(message: string) => void>();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript(ablyRules))(
    view,
    new URL(redirected),
    page,
  );
  const data = postMessage.mock.calls[0]![0];
  expect(
    readProductMessage(data, {
      origin: 'https://mobile.a-bly.com',
      pageURL: redirected,
      shops: ablyRules,
      requestedURL: canonical,
    }),
  ).toEqual({
    documentURL: redirected,
    metadata: { ...extracted, url: canonical, imageURL: ablyImage },
    complete: true,
  });
  expect(
    readProductMessage(data, {
      origin: redirected,
      pageURL: redirected,
      shops: ablyRules,
      requestedURL: canonical.replace('13519743', '9'),
    }),
  ).toBeNull();
  expect(
    readProductMessage(data, {
      origin: redirected,
      pageURL: redirected,
      shops,
      requestedURL: canonical,
    }),
  ).toBeNull();
  expect(isProductExtractionURL('https://mobile.a-bly.com/account', true)).toBe(false);
  expect(isProductExtractionURL('https://www.musinsa.com', true)).toBe(false);
  expect(isProductExtractionURL('https://s.zigzag.kr/example', true)).toBe(true);
  expect(isProductExtractionURL('https://s.zigzag.kr/example')).toBe(false);
});

it('keeps an unavailable Ably product alert from blocking manual entry', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/13519743';
  const page = document.implementation.createHTMLDocument();
  const nativeAlert = vi.fn();
  const postMessage = vi.fn();
  const view = {
    alert: nativeAlert,
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  const rules = [{ ...shops[0]!, hosts: ['m.a-bly.com'] }];
  const run = new Function('window', 'location', 'document', productScanScript(rules));
  run(view, new URL(url), page);
  view.alert('다른 알림');
  expect(nativeAlert).toHaveBeenCalledExactlyOnceWith('다른 알림');
  view.alert('판매 중인 상품이 아닙니다.');
  page.head.innerHTML = `<script type="application/ld+json">{"@type":"Product","sku":"13519743","name":"판매 종료 상품"}</script>`;
  run(view, new URL(url), page);
  vi.advanceTimersByTime(8_000);
  expect(nativeAlert).toHaveBeenCalledTimes(1);
  expect(postMessage).not.toHaveBeenCalled();
});

it('only reads Ably Open Graph blocks and retailer prices for the requested product ID', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/13519743';
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/item.jpg';
  const rules: Shops = [
    {
      hosts: ['a-bly.com', 'm.a-bly.com'],
      imageHosts: [new URL(imageURL).hostname],
      imageStrategy: 'SERVER_MIRROR',
      fields: {
        title: ["meta[property='og:title']@content"],
        price: ["meta[property='product:price:amount']@content"],
        image: ["meta[property='og:image']@content"],
      },
    },
  ];
  const scan = (
    retailerIds: string[],
    cardImage = imageURL,
    firstSlide = '',
    loadedWidth = 0,
    secondSlide = '',
    documentURL = url,
  ) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `
      <meta property="og:url" content="https://a-bly.com/app/goods/2">
      <meta property="og:title" content="추천 상품">
      <meta property="og:image" content="https://d3ha2047wt6x28.cloudfront.net/other.jpg">
      <meta property="og:url" content="${url}">
      <meta property="og:title" content="니트 원피스 모음">
      <meta property="og:image" content="${cardImage}">
      <meta property="product:price:currency" content="KRW">
      <meta property="product:price:amount" content="26,800">
      ${retailerIds.map((id) => `<meta property="product:retailer_item_id" content="${id}">`).join('')}`;
    page.body.innerHTML =
      '<div id="goods-detail-cover-item.0"><img></div>' +
      '<div id="goods-detail-cover-item.1"><img></div>';
    Object.defineProperties(page.body.querySelectorAll('img')[0]!, {
      currentSrc: { value: firstSlide },
      naturalWidth: { value: loadedWidth },
      complete: { value: loadedWidth > 0 },
    });
    page.body.querySelectorAll('img')[1]!.setAttribute('src', secondSlide);
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript(rules))(
      view,
      new URL(documentURL),
      page,
    );
    return postMessage;
  };
  const expected = { url, name: '니트 원피스 모음', price: 26_800, imageURL };
  const padded = url.replace('/13519743', '/0013519743') + '?coupon_sno=7';
  const data = scan(['13519743'], imageURL, '', 0, '', padded).mock.calls[0]?.[0];
  expect(
    readProductMessage(data ?? '', {
      origin: padded,
      pageURL: padded,
      shops: rules,
      requestedURL: padded,
    }),
  ).toEqual({
    documentURL: padded,
    metadata: { ...expected, url: 'https://m.a-bly.com/goods/13519743' },
    complete: true,
  });
  expect(scan(['13519744'], imageURL, '', 0, '', padded)).not.toHaveBeenCalled();
  const cover = imageURL.replace('item.jpg', 'cover.jpg');
  expect(scan(['13519743'], imageURL, cover, 0, imageURL)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: cover }),
  );
  expect(scan([], imageURL, cover, 0, imageURL)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: null }),
  );
  expect(scan(['13519743'], imageURL, cover, 720)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: cover }),
  );
  for (const [ids, src] of [
    [[], cover],
    [['13519743'], 'https://example.org/other.jpg'],
  ] as const) {
    expect(scan([...ids], imageURL, src, 720)).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(expected),
    );
  }
  expect(scan(['13519743'], imageURL, cover)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  expect(
    scan(['13519743'], 'https://imgb.a-bly.com/card.gif', cover),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, imageURL: cover }));
  for (const [ids, slide] of [
    [[], cover],
    [['13519743'], 'https://example.org/cover.jpg'],
  ] as const) {
    expect(scan([...ids], '', slide)).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ ...expected, imageURL: null }),
    );
  }
  expect(scan(['13519743', '2'], '', cover)).not.toHaveBeenCalled();
});

it.each([
  'web first',
  'web only',
  'different app ID',
  'unverified web',
  'web title differs',
  'brand in the standard detail name',
  'brand in the promotion detail name',
  'empty app title',
  'conflicting detail name',
])('uses the actual Ably name when sharing cards vary: %s', (scenario) => {
  vi.useFakeTimers();
  const id = '3798513';
  const url = `https://mobile.a-bly.com/goods/${id}`;
  const name = '유유존  리본 파우치';
  const webTitle = `유유존 ${name}`;
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/item.jpg';
  const page = document.implementation.createHTMLDocument();
  page.title = `${scenario === 'web title differs' ? '다른 제목' : webTitle.replace(/\s+/g, ' ')} - 에이블리 스토어`;
  page.head.insertAdjacentHTML(
    'beforeend',
    `
      <meta property="og:url" content="${url}">
      <meta property="og:title" content="${webTitle} - 에이블리">
      <meta property="og:image" content="${imageURL}">
      ${
        ['web first', 'different app ID', 'empty app title'].includes(scenario)
          ? `
        <meta property="og:url" content="https://a-bly.com/app/goods/${scenario === 'different app ID' ? '2' : id}">
        <meta property="og:title" content="${scenario === 'web first' ? `${name} - 에이블리` : scenario === 'different app ID' ? '다른 상품 - 에이블리' : ''}">`
          : ''
      }
      <meta property="product:price:amount" content="4650">
      <meta property="product:brand" content="유유존">
      ${scenario === 'unverified web' ? '' : `<meta property="product:retailer_item_id" content="${id}">`}`,
  );
  const brandIsPartOfName =
    scenario === 'brand in the standard detail name' ||
    scenario === 'brand in the promotion detail name' ||
    scenario === 'empty app title';
  const detailTitle = brandIsPartOfName ? webTitle : '다른 상품 추천';
  if (brandIsPartOfName || scenario === 'conflicting detail name') {
    const price = '<div><div><button id="goods-detail-send">공유</button></div></div></div>';
    const promotion = scenario === 'brand in the promotion detail name';
    const mountDetail = () => {
      page.body.innerHTML = `<section>
          <div tabindex="0"><div data-testid="${detailTitle}">${detailTitle}</div></div>
          ${promotion ? `<div id="goods-detail-price-highlight">${price}</div>` : price}
        </section>`;
    };
    if (promotion) setTimeout(mountDetail, 300);
    else mountDetail();
  }
  const postMessage = vi.fn();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function(
    'window',
    'location',
    'document',
    productScanScript([
      {
        hosts: ['a-bly.com', 'm.a-bly.com'],
        imageHosts: [new URL(imageURL).hostname],
        imageStrategy: 'SERVER_MIRROR',
        fields: {
          title: ["meta[property='og:title']@content"],
          price: ["meta[property='product:price:amount']@content"],
          image: ["meta[property='og:image']@content"],
        },
      },
    ]),
  )(view, new URL(url), page);
  const waitsForDetail = [
    'web only',
    'different app ID',
    'brand in the promotion detail name',
    'conflicting detail name',
  ].includes(scenario);
  if (waitsForDetail) {
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ url, name: '', price: 4650, imageURL }),
    );
    vi.advanceTimersByTime(scenario === 'brand in the promotion detail name' ? 300 : 600);
  }
  expect(postMessage).toHaveBeenLastCalledWith(
    JSON.stringify({
      url,
      name:
        brandIsPartOfName || scenario === 'unverified web' || scenario === 'web title differs'
          ? webTitle
          : name,
      price: 4650,
      imageURL,
    }),
  );
});

it('falls back to the verified Ably public price group, never list price or personal estimates', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/13519743';
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/first.jpg';
  const rule = {
    ...shops[0]!,
    hosts: ['m.a-bly.com'],
    imageHosts: [new URL(imageURL).hostname],
    fields: {
      title: ["meta[property='og:title']@content"],
      price: ["meta[property='product:price:amount']@content"],
      image: [],
    },
  };
  const amount = (value: string) => `<div>${value}<span data-testid="원">원</span></div>`;
  const scan = ({
    group = amount('26,800'),
    retailer = '13519743',
    currency = 'KRW',
    metaPrice = '',
    query = '',
    couponLabel = false,
    heading = '',
    otherCard = false,
  } = {}) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `
      <meta property="og:url" content="${url}">
      <meta property="og:type" content="product">
      <meta property="og:title" content="니트 원피스 모음 - 에이블리">
      ${otherCard ? `<meta property="og:url" content="${url.replace('13519743', '9')}">` : ''}
      <meta property="product:retailer_item_id" content="${retailer}">
      <meta property="product:price:currency" content="${currency}">
      <meta property="product:price:amount" content="${metaPrice}">`;
    page.body.innerHTML = `<div id="goods-detail-cover-item.0"><img></div>
      <section>
        ${heading ? `<div tabindex="0"><div data-testid="${heading}">${heading}</div></div>` : ''}
        <div id="goods-detail-price-area">${couponLabel ? '<span data-testid="쿠폰적용가">쿠폰적용가</span>' : ''}<div>정가 ${amount('40,000')}</div>
          <div><div>33%${group}</div><div>적립금 ${amount('536')}</div><div id="goods-detail-send">공유하기</div></div>
        </div>
      </section>
      <div>나의 예상 구매가 ${amount('22,780')}</div>`;
    Object.defineProperty(page.querySelector('img'), 'currentSrc', { value: imageURL });
    const postMessage = vi.fn<(message: string) => void>();
    const window = {
      ReactNativeWebView: { postMessage },
      get top() {
        return window;
      },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      window,
      new URL(url + query),
      page,
    );
    const message = postMessage.mock.calls[0]?.[0];
    return message && JSON.parse(message);
  };
  expect(scan()).toMatchObject({ price: 26_800 });
  expect(scan({ metaPrice: '29,000' })).toMatchObject({ price: 29_000 });
  expect(scan({ group: amount('0') })).toMatchObject({ price: 0 });
  expect(scan({ group: amount('26,800') + amount('22,780') })).toMatchObject({ price: null });
  expect(scan({ group: '', currency: 'KRW' })).toMatchObject({ price: null });
  expect(scan({ retailer: '' })).toMatchObject({ price: null, imageURL: null });
  const heading = '니트 원피스 모음';
  const coupon = { heading, query: '?coupon_sno=45920189', couponLabel: true, metaPrice: '29,000' };
  expect(scan(coupon)).toMatchObject({ price: 26_800 });
  for (const change of [
    { query: '' },
    { query: '?coupon_sno=1&coupon_sno=2' },
    { couponLabel: false },
    { retailer: '' },
    { heading: '다른 상품' },
    { group: amount('0') },
    { group: amount('26,800') + amount('22,780') },
  ]) {
    expect(scan({ ...coupon, ...change })).toMatchObject({ price: 29_000 });
  }
  expect(scan({ ...coupon, currency: 'USD' })).toMatchObject({ price: null });
  expect(scan({ retailer: '', heading })).toMatchObject({ name: heading, price: 26_800, imageURL });
  expect(scan({ retailer: '', heading: '다른 상품' })).toMatchObject({
    price: null,
    imageURL: null,
  });
  expect(scan({ retailer: '', heading, otherCard: true })).toMatchObject({
    price: null,
    imageURL: null,
  });
  expect(scan({ retailer: '', heading, currency: 'USD' })).toMatchObject({ price: null, imageURL });
  expect(scan({ retailer: '9', heading })).toBeUndefined();
});

it('only uses Ably structured prices and images from the requested product', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/13519743';
  const ablyImage = 'https://d3ha2047wt6x28.cloudfront.net/item.jpg';
  const rule = {
    hosts: ['a-bly.com', 'm.a-bly.com'],
    imageHosts: [new URL(ablyImage).hostname],
    imageStrategy: 'SERVER_MIRROR' as const,
    fields: {
      title: ["meta[property='og:title']@content", 'ldjson:name'],
      price: ['ldjson:offers.price'],
      image: ['ldjson:image[0]'],
    },
  };
  const otherURL = url.replace('13519743', '51978009');
  const correct = {
    '@type': 'Product',
    sku: '13519743',
    name: '니트 원피스 모음',
    url: 'https://a-bly.com/app/goods/13519743',
    image: [ablyImage],
    offers: { url, price: 26_800, priceCurrency: 'KRW' },
  };
  const other = {
    ...correct,
    sku: '51978009',
    url: otherURL,
    image: [ablyImage.replace('item', 'other')],
    offers: { ...correct.offers, url: otherURL, price: 74_900 },
  };
  const scan = (products: object[], cardURL = url, documentURL = url) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `
      <meta property="og:type" content="product">
      <meta property="og:url" content="${cardURL}">
      <meta property="og:title" content="니트 원피스 모음">
      <script type="application/ld+json">${JSON.stringify(products)}</script>`;
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(documentURL),
      page,
    );
    return postMessage;
  };
  const name = correct.name;
  const expected = JSON.stringify({ url, name, price: 26_800, imageURL: ablyImage });
  const partial = JSON.stringify({ url, name, price: null, imageURL: null });
  expect(scan([other, correct])).toHaveBeenCalledExactlyOnceWith(expected);
  expect(scan([other, correct], otherURL)).toHaveBeenCalledExactlyOnceWith(expected);
  expect(scan([other, { ...correct, sku: undefined }])).toHaveBeenCalledExactlyOnceWith(expected);
  expect(scan([other])).toHaveBeenCalledExactlyOnceWith(partial);
  expect(scan([{ ...correct, offers: other.offers }])).toHaveBeenCalledExactlyOnceWith(partial);
  const withoutIdentity = { ...correct, sku: undefined, url: undefined, offers: { price: 26_800 } };
  expect(scan([withoutIdentity])).toHaveBeenCalledExactlyOnceWith(partial);
  expect(scan([{ ...withoutIdentity, '@id': '#product' }])).toHaveBeenCalledExactlyOnceWith(
    partial,
  );
  expect(scan([{ ...withoutIdentity, '@id': url }])).toHaveBeenCalledExactlyOnceWith(expected);
  const fragmentOffer = { url: '#offer', price: 74_900 };
  const recommendation = { ...withoutIdentity, url: '?from=recommend', offers: fragmentOffer };
  expect(scan([recommendation])).toHaveBeenCalledExactlyOnceWith(partial);
  expect(scan([recommendation, correct])).toHaveBeenCalledExactlyOnceWith(expected);
  // A local offer reference is fine when the product itself has an identifying path.
  const relative = {
    ...withoutIdentity,
    url: '/goods/13519743',
    offers: { url: '#offer', price: 26_800 },
  };
  expect(scan([relative])).toHaveBeenCalledExactlyOnceWith(expected);

  const couponURL = url + '?coupon_sno=44495066';
  const coupon = { url: couponURL, price: 22_500, priceCurrency: 'KRW' };
  const regular = { url, price: 25_000, priceCurrency: 'KRW' };
  const checkOffer = (offers: object, documentURL: string, price: number | null) =>
    expect(scan([{ ...correct, offers }], url, documentURL)).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ url: documentURL, name, price, imageURL: ablyImage }),
    );
  checkOffer([regular, coupon], couponURL + '&utm_source=share', 22_500);
  checkOffer([coupon, regular], url, 25_000);
  checkOffer(coupon, url, null);
  checkOffer(regular, couponURL, null);
  checkOffer(coupon, couponURL + '!', null);
  checkOffer(coupon, couponURL + '&coupon_sno=2', null);
  checkOffer({ ...coupon, url: '?coupon_sno=44495066#offer' }, couponURL, 22_500);
  checkOffer([coupon, { ...coupon, price: 1 }], couponURL, null);
  checkOffer([{ url: 42, price: 1 }, coupon], couponURL, 22_500);
  for (const offerURL of [undefined, '#offer']) {
    const offers = { ...coupon, url: offerURL };
    checkOffer(offers, couponURL, null);
    expect(
      scan([{ ...correct, url: couponURL, offers }], url, couponURL),
    ).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ url: couponURL, name, price: 22_500, imageURL: ablyImage }),
    );
  }
});

it('fills missing Ably Open Graph fields only from Twitter cards with the same product URL', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/12331299';
  const imageURL = 'https://d3ha2047wt6x28.cloudfront.net/pdp.jpg';
  const rule = {
    ...shops[0]!,
    hosts: ['a-bly.com', 'm.a-bly.com'],
    imageHosts: [new URL(imageURL).hostname],
    fields: {
      title: ["meta[property='og:title']@content", 'title'],
      price: ["meta[property='product:price:amount']@content"],
      image: ["meta[property='og:image']@content"],
    },
  };
  const scan = (
    cardURL: string,
    extra = '',
    price = '47,000',
    cardImage = imageURL,
    retailerId = '12331299',
  ) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `
      <title>에이블리</title>
      <meta property="twitter:url" content="https://a-bly.com/app/goods/2">
      <meta property="twitter:title" content="추천 상품">
      <meta property="twitter:image" content="https://d3ha2047wt6x28.cloudfront.net/other.jpg">
      <meta property="twitter:url" content="${cardURL}">
      <meta property="twitter:title" content="후드 니트 - 에이블리">
      <meta property="twitter:image" content="${cardImage}">
      <meta property="product:retailer_item_id" content="${retailerId}">
      <meta property="product:price:currency" content="KRW">
      <meta property="product:price:amount" content="${price}">
      ${extra}`;
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(url),
      page,
    );
    return postMessage;
  };
  const expected = { url, name: '후드 니트', price: 47_000, imageURL };
  expect(scan(url)).toHaveBeenCalledExactlyOnceWith(JSON.stringify(expected));
  expect(
    scan(
      url,
      `<meta property="og:url" content="${url}"><meta property="og:title" content="대표 - 에이블리 상품명 - 에이블리">`,
    ),
  ).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, name: '대표 - 에이블리 상품명' }),
  );
  const ogImage = imageURL.replace('pdp.jpg', 'og.jpg');
  expect(
    scan(
      url,
      `<meta property="og:url" content="${url}"><meta property="og:image" content="${ogImage}">`,
    ),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, imageURL: ogImage }));
  expect(scan(url, '', '47,000', 'https://imgb.a-bly.com/pdp.gif')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: null }),
  );
  const conflictingOG = `<meta property="og:url" content="https://a-bly.com/app/goods/2">
    <meta property="og:title" content="추천 상품">
    <meta property="og:image" content="https://d3ha2047wt6x28.cloudfront.net/other.jpg">`;
  expect(scan(url, conflictingOG)).toHaveBeenCalledExactlyOnceWith(JSON.stringify(expected));
  expect(scan(url, conflictingOG, '100', imageURL, '')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: null }),
  );
  expect(scan(url, conflictingOG, '100', imageURL, '2')).not.toHaveBeenCalled();
  expect(scan('https://mobile.a-bly.com/goods/2', conflictingOG)).not.toHaveBeenCalled();
  expect(scan(url, '', '')).not.toHaveBeenCalled();
  expect(scan('https://mobile.a-bly.com/goods/2')).not.toHaveBeenCalled();
  expect(scan('https://mobile.a-bly.com.example.org/goods/12331299')).not.toHaveBeenCalled();
});

it('reads a verified Ably product name from a storefront page title without the storefront labels', () => {
  vi.useFakeTimers();
  const url = 'https://mobile.a-bly.com/goods/13848135';
  const rule = {
    ...shops[0]!,
    hosts: ['m.a-bly.com'],
    fields: {
      title: ['title'],
      image: [],
      price: ["meta[property='product:price:amount']@content"],
    },
  };
  const scan = (title: string, brand: string, retailerId = '13848135') => {
    const page = document.implementation.createHTMLDocument();
    page.title = title;
    page.head.insertAdjacentHTML(
      'beforeend',
      `
      <meta property="product:retailer_item_id" content="${retailerId}">
      <meta property="product:brand" content="${brand}">
      <meta property="product:price:amount" content="11340">`,
    );
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(url),
      page,
    );
    return postMessage.mock.calls[0]?.[0] && JSON.parse(postMessage.mock.calls[0]![0]).name;
  };
  const name = '[당일출고][MADE/6color]피크닉 트윌 오버핏 남방 셔츠';
  expect(scan(`베이델리 ${name} - 에이블리 스토어`, '베이델리')).toBe(name);
  expect(scan(`베이델리 ${name} - 에이블리 스토어`, '다른 판매자')).toBe(`베이델리 ${name}`);
  expect(scan('상품 상세 - 에이블리 스토어', '베이델리')).toBe('');
  expect(scan(`베이델리 ${name} - 에이블리 스토어`, '베이델리', '')).toBe(`베이델리 ${name}`);
  expect(scan(`베이델리 ${name} - 에이블리 스토어`, '베이델리', '2')).toBeUndefined();
  expect(scan('베이델리 상품명', '베이델리')).toBe('베이델리 상품명');
});

it('selects a valid image and ignores explicitly non-KRW offers', () => {
  vi.useFakeTimers();
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML = `
    <meta property="og:image" content="https://example.org/placeholder.png">
    <meta property="og:image" content="${imageURL}">
    <meta property="product:price:amount" content="29">
    <meta property="product:price:currency" content="USD">
    <script type="application/ld+json">{"@type":"Product","name":"가디건","offers":[{"price":29,"priceCurrency":"USD"},{"price":39000,"priceCurrency":"KRW"}]}</script>`;
  const rule = {
    ...shops[0]!,
    fields: {
      title: ['ldjson:name'],
      price: ["meta[property='product:price:amount']@content", 'ldjson:offers.price'],
      image: ["meta[property='og:image']@content"],
    },
  };
  const postMessage = vi.fn();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript([rule]))(
    view,
    new URL(finalUrl),
    page,
  );
  expect(postMessage).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
});

it('uses only an unambiguous public price from metadata tags', () => {
  vi.useFakeTimers();
  const rule = {
    ...shops[0]!,
    fields: {
      title: ["meta[property='og:title']@content"],
      price: ["meta[property='product:price:amount']@content", 'ldjson:offers.price'],
      image: [],
    },
  };
  const scan = (amounts: string[], currencies: string[], fallback?: number) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `
      <meta property="og:type" content="product">
      <meta property="og:url" content="${finalUrl}">
      <meta property="og:title" content="가디건">
      ${amounts.map((value) => `<meta property="product:price:amount" content="${value}">`).join('')}
      ${currencies.map((value) => `<meta property="product:price:currency" content="${value}">`).join('')}
      ${
        fallback === undefined
          ? ''
          : `<script type="application/ld+json">${JSON.stringify({
              '@type': 'Product',
              url: finalUrl,
              offers: { price: fallback, priceCurrency: 'KRW' },
            })}</script>`
      }`;
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(finalUrl),
      page,
    );
    return JSON.parse(postMessage.mock.calls[0]![0]).price;
  };
  expect(scan(['39,000', '39000.00'], ['KRW', 'krw'])).toBe(39_000);
  expect(scan(['30000', '39000'], ['KRW'], 39_000)).toBe(39_000);
  expect(scan(['39', '39000'], ['KRW', 'USD'])).toBeNull();
  expect(scan(['30000', '39000'], ['KRW'])).toBeNull();
});

it('reads scalar JSON-LD images and rejects ambiguous KRW offers', () => {
  vi.useFakeTimers();
  const rule = { ...shops[0]!, fields: { ...shops[0]!.fields, price: ['ldjson:offers.price'] } };
  const scan = (image: unknown, prices: (string | [string, string?])[], pageCurrency?: string) => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `${pageCurrency ? `<meta property="product:price:currency" content="${pageCurrency}">` : ''}
    <script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      sku: '7',
      name: extracted.name,
      image,
      offers: prices.map((entry) => {
        const [price, priceCurrency] = typeof entry === 'string' ? [entry, 'KRW'] : entry;
        return { url: finalUrl, price, priceCurrency };
      }),
    })}</script>`;
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(finalUrl),
      page,
    );
    return postMessage;
  };
  expect(scan(imageURL, ['39000.00'])).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
  expect(
    scan([{ '@type': 'ImageObject', contentUrl: imageURL }], ['39,000', '39000.0']),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
  expect(scan([imageURL], ['39000', '42000'])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, price: null }),
  );
  expect(scan(imageURL, [['29']], 'USD')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, price: null }),
  );
  expect(scan(imageURL, [['29'], ['29', 'USD']])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, price: null }),
  );
  expect(scan(imageURL, [['29'], '39000'], 'USD')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(extracted),
  );
  expect(scan(imageURL, [['39000']])).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
  expect(scan([imageURL], ['39000.01'])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, price: null }),
  );
  expect(
    scan({ '@type': 'ImageObject', url: 'https://outside.example/card.png' }, ['39000']),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...extracted, imageURL: null }));
});

it('ignores metadata on a security challenge page', () => {
  vi.useFakeTimers();
  const page = document.implementation.createHTMLDocument();
  page.title = '보안 확인 중..';
  page.head.insertAdjacentHTML(
    'beforeend',
    '<script type="application/ld+json">' + '{"@type":"Product","name":"가디건"}</script>',
  );
  const postMessage = vi.fn();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript(shops))(
    view,
    new URL(finalUrl),
    page,
  );
  vi.advanceTimersByTime(8_000);
  expect(postMessage).not.toHaveBeenCalled();
});

it('does not fill a generic storefront title from a missing-product page returning 200', () => {
  vi.useFakeTimers();
  const page = document.implementation.createHTMLDocument();
  page.head.innerHTML =
    '<meta property="og:title" content="지그재그 스토어">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:image" content="https://cf.product-image.s.zigzag.kr/store-logo.png">';
  const rule = {
    ...shops[0]!,
    imageHosts: ['cf.product-image.s.zigzag.kr'],
    fields: {
      title: ["meta[property='og:title']@content"],
      price: [],
      image: ["meta[property='og:image']@content"],
    },
  };
  const postMessage = vi.fn();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  new Function('window', 'location', 'document', productScanScript([rule]))(
    view,
    new URL(finalUrl),
    page,
  );
  vi.advanceTimersByTime(8_000);
  expect(postMessage).not.toHaveBeenCalled();
});

it('prefers the verified Musinsa item name and fills missing price and image from the PDP', () => {
  vi.useFakeTimers();
  const url = 'https://www.musinsa.com/products/4804589';
  const name = '지퍼 압축 파우치 24인치팩 [블랙]';
  const thumbnailImageUrl = '/images/goods_img/20250219/4804589/4804589_17484100383095_500.jpg';
  const scan = (
    goodsNo: number,
    currency: string,
    pricing = {},
    images: {
      meta?: string | null;
      detail?: string;
      og?: string;
      ogTitle?: string;
      headDesc?: string;
      headings?: string[];
    } = {},
    summaryName: string | null = name,
    detailPricing?: object,
    pathId = '4804589',
  ) => {
    const page = document.implementation.createHTMLDocument();
    page.title = '무신사';
    for (const heading of images.headings ?? []) {
      const span = page.createElement('span');
      span.className = 'GoodsName-sc-789d282d-1';
      span.textContent = heading;
      page.body.append(span);
    }
    if (images.ogTitle) {
      const tag = page.createElement('meta');
      tag.setAttribute('property', 'og:title');
      tag.content = images.ogTitle;
      page.head.append(tag);
    }
    if (images.og) {
      const tag = page.createElement('meta');
      tag.setAttribute('property', 'og:image');
      tag.content = images.og;
      page.head.append(tag);
    }
    const script = page.createElement('script');
    script.id = '__NEXT_DATA__';
    script.textContent = JSON.stringify({
      page: '/products/[productId]',
      query: { productId: pathId },
      props: {
        pageProps: {
          hasDetail: true,
          meta:
            summaryName === null
              ? undefined
              : {
                  data: {
                    goodsNm: summaryName,
                    thumbnailImageUrl: images.meta === undefined ? thumbnailImageUrl : images.meta,
                    goodsPrice:
                      summaryName === name
                        ? { finalPrice: 24_490, currency, ...pricing }
                        : { salePrice: 1, currency: 'KRW' },
                  },
                },
          dehydratedState: {
            queries: [
              {
                queryKey: ['Detail', 4804589],
                state: {
                  data: {
                    data: {
                      goodsNo,
                      goodsNm: name,
                      headDesc: images.headDesc,
                      thumbnailImageUrl: images.detail,
                      goodsPrice:
                        detailPricing ??
                        (summaryName !== name
                          ? { finalPrice: 24_490, currency, ...pricing }
                          : undefined),
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });
    page.head.append(script);
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    const rules = [
      {
        ...shops[0]!,
        fields: {
          ...shops[0]!.fields,
          title: ["meta[property='og:title']@content", 'ldjson:name', 'title'],
          image: ["meta[property='og:image']@content"],
        },
      },
    ];
    new Function('window', 'location', 'document', productScanScript(rules))(
      view,
      new URL(url.replace('4804589', pathId)),
      page,
    );
    return postMessage;
  };
  const product = {
    url,
    name,
    price: 24_490,
    imageURL: `https://image.msscdn.net${thumbnailImageUrl}`,
  };
  expect(scan(4804589, 'KRW')).toHaveBeenCalledExactlyOnceWith(JSON.stringify(product));
  const paddedId = '004804589';
  expect(scan(4804589, 'KRW', {}, {}, name, undefined, paddedId)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, url: url.replace('4804589', paddedId) }),
  );
  expect(scan(4804588, 'KRW', {}, {}, name, undefined, paddedId)).not.toHaveBeenCalled();
  const headDesc = '[2016 S/S]';
  const fullName = headDesc + name;
  const rendered = { headDesc, headings: [fullName] };
  expect(scan(4804589, 'KRW', {}, rendered)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, name: fullName }),
  );
  expect(scan(6623590, 'KRW', {}, rendered)).not.toHaveBeenCalled();
  for (const headings of [[], [name], ['추천 ' + name], [fullName, '다른 상품']]) {
    expect(scan(4804589, 'KRW', {}, { headDesc, headings })).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(product),
    );
  }
  expect(scan(4804589, 'USD')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, price: null }),
  );
  expect(scan(6623590, 'KRW')).not.toHaveBeenCalled();
  const wrongImage =
    'https://image.msscdn.net/thumbnails/images/goods_img/20251201/6623590/other.jpg?w=780';
  const resized = `https://image.msscdn.net/thumbnails${thumbnailImageUrl}?w=780`;
  expect(scan(4804589, 'KRW', {}, { og: resized })).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, imageURL: resized }),
  );
  for (const og of [wrongImage, wrongImage.replace('goods_img', 'prd_img')]) {
    expect(scan(4804589, 'KRW', {}, { og })).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(product),
    );
  }
  const detailImage = resized.replace('goods_img', 'prd_img');
  // The additional gallery photo carries the very same product ID as the cover.
  for (const meta of [null, thumbnailImageUrl, detailImage]) {
    expect(
      scan(4804589, 'KRW', {}, { meta, detail: thumbnailImageUrl, og: detailImage }),
    ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(product));
  }
  expect(
    scan(4804589, 'KRW', {}, { detail: thumbnailImageUrl, og: resized }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, imageURL: resized }));
  expect(scan(4804589, 'KRW', {}, { og: detailImage })).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, imageURL: detailImage }),
  );
  expect(
    scan(4804589, 'KRW', {}, { meta: wrongImage, detail: thumbnailImageUrl }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(product));
  expect(
    scan(4804589, 'KRW', {}, { meta: null, detail: thumbnailImageUrl }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(product));
  expect(
    scan(4804589, 'KRW', {}, { meta: wrongImage, detail: 'https://example.com/image.jpg' }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, imageURL: null }));
  const coupon = { couponDiscount: true, finalPrice: 134_100 };
  expect(
    scan(
      4804589,
      'KRW',
      { ...coupon, salePrice: 149_000 },
      {
        ogTitle: `브랜드(BRAND) ${name} - 사이즈 & 후기 | 무신사`,
      },
    ),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: 149_000 }));
  expect(scan(4804589, 'KRW', coupon)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, price: null }),
  );
  const detailPricing = { currency: 'KRW', couponDiscount: true, salePrice: 149_000 };
  for (const summaryPrice of [coupon, { finalPrice: 134_100 }, { salePrice: -1 }]) {
    expect(
      scan(4804589, 'KRW', summaryPrice, {}, name, detailPricing),
    ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: 149_000 }));
  }
  expect(scan(4804589, 'USD', coupon, {}, name, detailPricing)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...product, price: null }),
  );
  expect(
    scan(4804589, 'KRW', coupon, {}, name, { ...detailPricing, currency: 'USD' }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: null }));
  expect(
    scan(4804589, 'KRW', coupon, {}, name, {
      ...detailPricing,
      salePrice: undefined,
      finalPrice: 134_100,
    }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: null }));
  expect(
    scan(4804589, 'KRW', { salePrice: 0 }, {}, name, detailPricing),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: 0 }));
  for (const summaryName of [null, '다른 상품']) {
    const images = { meta: 'https://image.msscdn.net/other.jpg', detail: thumbnailImageUrl };
    expect(
      scan(4804589, 'KRW', { ...coupon, salePrice: 149_000 }, images, summaryName),
    ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...product, price: 149_000 }));
    expect(scan(4804589, 'USD', coupon, images, summaryName)).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ ...product, price: null }),
    );
    expect(scan(6623590, 'KRW', coupon, images, summaryName)).not.toHaveBeenCalled();
  }
});

it('does not use a Musinsa recommendation as the requested product', () => {
  vi.useFakeTimers();
  const rule = {
    ...shops[0]!,
    fields: {
      title: ["meta[property='og:title']@content", 'ldjson:name'],
      price: ["meta[property='product:price:amount']@content", 'ldjson:offers.price'],
      image: ["meta[property='og:image']@content", 'ldjson:image[0]'],
    },
  };
  const product = {
    '@type': 'Product',
    sku: '7',
    url: finalUrl,
    name: extracted.name,
    image: [imageURL],
    offers: { url: finalUrl, price: extracted.price, priceCurrency: 'KRW' },
  };
  const otherURL = 'https://www.musinsa.com/products/8';
  const other = {
    ...product,
    sku: '8',
    url: otherURL,
    name: '추천 상품',
    offers: { ...product.offers, url: otherURL, price: 10_000 },
  };
  const scan = (entries: unknown[], ogURL?: string, suffix = ' - 사이즈 & 후기 | 무신사') => {
    const page = document.implementation.createHTMLDocument();
    page.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({ '@graph': entries })}</script>`;
    if (ogURL)
      page.head.insertAdjacentHTML(
        'beforeend',
        `
      <meta property="og:url" content="${ogURL}">
      <meta property="og:title" content="공개 상품명${suffix}">
      <meta property="product:price:amount" content="${ogURL === otherURL ? 10_000 : 39_000}">
      <meta property="og:image" content="${ogURL === otherURL ? 'https://image.msscdn.net/other.png' : imageURL}">`,
      );
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(finalUrl),
      page,
    );
    return postMessage;
  };
  expect(scan([other, product])).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
  expect(scan([other, product], finalUrl)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(extracted),
  );
  expect(scan([other])).not.toHaveBeenCalled();
  expect(scan([{ ...product, offers: other.offers }])).not.toHaveBeenCalled();
  expect(scan([{ ...other, '@id': finalUrl }])).not.toHaveBeenCalled();
  expect(scan([{ ...product, '@id': otherURL }])).not.toHaveBeenCalled();
  const idOnly = {
    ...product,
    '@id': finalUrl,
    url: undefined,
    sku: undefined,
    offers: { ...product.offers, url: undefined },
  };
  expect(scan([other, idOnly], finalUrl)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(extracted),
  );
  expect(scan([other, { ...idOnly, '@id': '#product' }])).not.toHaveBeenCalled();
  expect(scan([other], otherURL)).not.toHaveBeenCalled();
  expect(scan([other], '#product')).not.toHaveBeenCalled();
  expect(scan([other], finalUrl)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, name: '공개 상품명' }),
  );
  expect(scan([other], finalUrl, ' - 후기 | 무신사')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, name: '공개 상품명' }),
  );
  expect(scan([other], finalUrl, ' - 후기 | 리미티드')).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...extracted, name: '공개 상품명 - 후기 | 리미티드' }),
  );
  expect(scan([product], otherURL)).toHaveBeenCalledExactlyOnceWith(JSON.stringify(extracted));
});

it('fills Zigzag metadata missing from tags using only the matching PDP query', () => {
  vi.useFakeTimers();
  const url = 'https://zigzag.kr/catalog/products/169420901';
  const image = 'https://cf.product-image.s.zigzag.kr/original/sample.jpeg';
  const pdp = (
    id: string,
    product_price: object = {
      final_discount_info: { discount_price: 35_690 },
      max_price_info: { price: 52_500 },
    },
  ) => ({
    queryKey: ['getPdpBaseInfo', id],
    state: {
      data: {
        shop: { name: '드무어' },
        product: {
          id,
          name: '[DEMOOR] 크리시 비조 절개 팬츠',
          product_price,
          product_image_list: [{ url: image }],
        },
      },
    },
  });
  const scan = (
    queries: unknown[],
    cardImage?: string | string[],
    { streaming = false, heading = '', headingDelay = 0, retailer = '', currency = 'KRW' } = {},
  ) => {
    const page = document.implementation.createHTMLDocument();
    let loading = streaming;
    Object.defineProperty(page, 'readyState', { get: () => (loading ? 'loading' : 'complete') });
    page.title = '지그재그 스토어';
    const addHeading = () => {
      if (heading) page.body.innerHTML = `<h1>${heading}</h1>`;
    };
    if (headingDelay) {
      setTimeout(() => {
        loading = false;
        addHeading();
      }, headingDelay);
    } else addHeading();
    page.head.insertAdjacentHTML(
      'beforeend',
      cardImage
        ? `<meta property="og:url" content="${url}">
           <meta property="og:title" content="드무어 [DEMOOR] 크리시 비조 절개 팬츠">
           ${[cardImage]
             .flat()
             .map((src) => `<meta property="og:image" content="${src}">`)
             .join('')}
           <meta property="product:retailer_item_id" content="${retailer}">
           <meta property="product:price:amount" content="35690">`
        : `<meta property="og:title" content="추천 상품">
           <meta property="product:price:amount" content="1">
           <script type="application/ld+json">{"@type":"Product","sku":"171067691","name":"추천 상품"}</script>`,
    );
    page.head.insertAdjacentHTML(
      'beforeend',
      `<meta property="product:price:currency" content="${currency}">`,
    );
    const script = page.createElement('script');
    script.id = '__NEXT_DATA__';
    script.textContent = JSON.stringify({
      query: { catalog_product_id: '169420901' },
      props: { pageProps: { dehydratedState: { queries } } },
    });
    if (streaming) {
      if (queries.length) setTimeout(() => page.head.append(script), 200);
    } else page.head.append(script);
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    const rules = [
      {
        ...shops[0]!,
        hosts: ['zigzag.kr'],
        imageHosts: [new URL(image).hostname],
        fields: {
          title: ["meta[property='og:title']@content", 'ldjson:name', 'title'],
          price: ["meta[property='product:price:amount']@content", 'ldjson:offers.price'],
          image: ["meta[property='og:image']@content", 'ldjson:image[0]'],
        },
      },
    ];
    new Function('window', 'location', 'document', productScanScript(rules))(
      view,
      new URL(url),
      page,
    );
    return postMessage;
  };
  expect(scan([pdp('171067691')])).not.toHaveBeenCalled();
  const expected = {
    url,
    name: '[DEMOOR] 크리시 비조 절개 팬츠',
    price: 35_690,
    imageURL: image,
  };
  expect(scan([pdp('171067691'), pdp('169420901')])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  // A closed listing can retain the full query record behind a missing-product screen.
  const closed = pdp('169420901');
  Object.assign(closed.state.data.product, { sales_status: 'CLOSED' });
  expect(scan([closed])).not.toHaveBeenCalled();
  expect(scan([closed], image, { heading: '존재하지 않는 상품입니다' })).not.toHaveBeenCalled();
  const visibleClosed = scan([closed], image, { heading: expected.name, headingDelay: 200 });
  expect(visibleClosed).not.toHaveBeenCalled();
  vi.advanceTimersByTime(300);
  expect(visibleClosed).toHaveBeenCalledExactlyOnceWith(JSON.stringify(expected));
  const identifiedImage =
    'https://cf.product-image.s.zigzag.kr/original/c/16/942/090/169420901-123456789.jpeg';
  // Each gallery slide can carry the same product ID. Only slide zero is the cover.
  const gallery = pdp('169420901');
  const slideTwo = identifiedImage.replace('123456789.jpeg', '987654321.jpeg');
  gallery.state.data.product.product_image_list = [{ url: identifiedImage }, { url: slideTwo }];
  const resized = `${identifiedImage}?width=720&format=jpeg`;
  expect(scan([gallery], [slideTwo, resized])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: resized }),
  );
  expect(scan([gallery], slideTwo)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, imageURL: identifiedImage }),
  );
  const otherImage = identifiedImage.replace('/169420901-', '/137794146-');
  expect(scan([pdp('169420901')], otherImage)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );

  const verifiedHeading = { heading: expected.name, retailer: '169420901' };
  expect(scan([], image, verifiedHeading)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  const sharingName = { ...expected, name: `드무어 ${expected.name}` };
  expect(scan([], image, { ...verifiedHeading, retailer: '' })).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(sharingName),
  );
  expect(
    scan([], image, { ...verifiedHeading, heading: '추천 상품' }),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(sharingName));
  expect(scan([], image, { ...verifiedHeading, retailer: '171067691' })).not.toHaveBeenCalled();

  const lateHeading = scan([], image, { ...verifiedHeading, headingDelay: 250 });
  const noHeading = scan([], image, { ...verifiedHeading, heading: '', headingDelay: 250 });
  expect(lateHeading).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, name: '' }));
  vi.advanceTimersByTime(300);
  expect(lateHeading).toHaveBeenLastCalledWith(JSON.stringify(expected));
  expect(noHeading).toHaveBeenLastCalledWith(JSON.stringify({ ...expected, name: '' }));
  vi.advanceTimersByTime(300);
  expect(noHeading).toHaveBeenLastCalledWith(JSON.stringify(sharingName));

  const loading = scan([pdp('169420901')], image, { streaming: true });
  const cardOnly = scan([], image, { streaming: true });
  expect(loading).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, name: '' }));
  vi.advanceTimersByTime(300);
  expect(loading).toHaveBeenLastCalledWith(JSON.stringify(expected));
  expect(cardOnly).toHaveBeenLastCalledWith(JSON.stringify({ ...expected, name: '' }));
  vi.advanceTimersByTime(300);
  expect(cardOnly).toHaveBeenLastCalledWith(
    JSON.stringify({ ...expected, name: '드무어 [DEMOOR] 크리시 비조 절개 팬츠' }),
  );

  const slowBody = scan([], image, { ...verifiedHeading, streaming: true, headingDelay: 2_950 });
  vi.advanceTimersByTime(2_700);
  expect(slowBody).toHaveBeenLastCalledWith(JSON.stringify({ ...expected, name: '' }));
  vi.advanceTimersByTime(300);
  expect(slowBody).toHaveBeenLastCalledWith(JSON.stringify(expected));

  const display = (price: number, display_currency = '원') => ({
    price,
    price_with_currency: { display_currency },
  });
  const scanDisplay = (additional: ReturnType<typeof display> | null, discountPrice?: number) =>
    scan([
      pdp('169420901', {
        final_discount_info: { discount_price: discountPrice },
        display_final_price: { final_price: display(44_620), final_price_additional: additional },
        max_price_info: { price: 52_500 },
      }),
    ]);
  expect(scanDisplay(display(35_690))).toHaveBeenCalledExactlyOnceWith(JSON.stringify(expected));
  expect(scanDisplay(display(35_690), 44_620)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  expect(scanDisplay(null, 35_690)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: 44_620 }),
  );
  expect(scanDisplay(null)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: 44_620 }),
  );
  // The storefront publishes the starting price, not the price of a selected option.
  expect(scanDisplay(display(35_690, '원~'), 35_690)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  expect(
    scan(
      [
        pdp('169420901', {
          final_discount_info: { discount_price: 35_690 },
          display_final_price: { final_price: display(35_690, '원~') },
        }),
      ],
      image,
      { currency: 'USD' },
    ),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, price: null }));
  for (const legacy of [undefined, 44_620]) {
    expect(scanDisplay(display(35_690, '원~'), legacy)).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ ...expected, price: null }),
    );
  }
  expect(scanDisplay(display(30, '$'), 30)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: null }),
  );
  expect(scanDisplay(display(35_690), -1)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  expect(scanDisplay(display(35_690), 12.5)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify(expected),
  );
  expect(scanDisplay(display(0), 49_000)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: 0 }),
  );
  expect(scan([pdp('169420901')], image, { currency: 'USD' })).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ ...expected, price: null }),
  );
  expect(
    scan(
      [
        pdp('169420901', {
          final_discount_info: { discount_price: 29 },
          display_final_price: { final_price: display(35_690) },
        }),
      ],
      image,
      { currency: 'USD' },
    ),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify(expected));
  expect(
    scan([pdp('169420901', { max_price_info: { price: 52_500 } })]),
  ).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ ...expected, price: null }));
});

it('rejects unrelated Zigzag JSON-LD and keeps the matching product when both appear', () => {
  vi.useFakeTimers();
  const url = 'https://zigzag.kr/catalog/products/171190375';
  const other = 'https://zigzag.kr/catalog/products/169420901';
  const image = 'https://cf.product-image.s.zigzag.kr/original/sample.jpeg';
  const product = {
    '@type': 'Product',
    sku: '171190375',
    name: '디아즈 니트',
    image: [image],
    offers: { url, price: 34200, priceCurrency: 'KRW' },
  };
  const recommendation = {
    ...product,
    sku: '169420901',
    name: '추천 팬츠',
    offers: { ...product.offers, url: other, price: 35690 },
  };
  const scan = (products: unknown[], retailerId = '171190375', ogURL?: string, next?: object) => {
    const page = document.implementation.createHTMLDocument();
    const ogImage = image.replace('sample.jpeg', 'preview.jpeg');
    page.head.innerHTML = `<meta property="product:retailer_item_id" content="${retailerId}">
      <script type="application/ld+json">${JSON.stringify({ '@graph': products })}</script>
      <script id="__NEXT_DATA__">${JSON.stringify(next ?? {})}</script>`;
    if (ogURL)
      page.head.insertAdjacentHTML(
        'beforeend',
        `
      <meta property="og:url" content="${ogURL}">
      <meta property="og:title" content="공개 미리보기 제목">
      <meta property="og:image" content="${ogImage}">
      <meta property="product:price:amount" content="${ogURL === url ? 34200 : 35690}">
      <meta property="product:price:currency" content="KRW">`,
      );
    const postMessage = vi.fn();
    const view = {
      get top() {
        return view;
      },
      ReactNativeWebView: { postMessage },
    };
    const rule = {
      ...shops[0]!,
      hosts: ['zigzag.kr'],
      imageHosts: [new URL(image).hostname],
      fields: {
        title: ["meta[property='og:title']@content", 'ldjson:name'],
        price: [
          "meta[property='product:price:amount']@content",
          'ldjson:offers.price',
          'json:__NEXT_DATA__.props.pageProps.product.final_price',
        ],
        image: ["meta[property='og:image']@content", 'ldjson:image[0]'],
      },
    };
    new Function('window', 'location', 'document', productScanScript([rule]))(
      view,
      new URL(url),
      page,
    );
    return postMessage;
  };
  const withoutPrice = [{ ...product, offers: undefined }];
  const legacy = (queryId: string, id: string | undefined) => ({
    query: { catalog_product_id: queryId },
    props: { pageProps: { product: { id, final_price: 29_000 } } },
  });
  const resultWith = (price: number | null) =>
    JSON.stringify({ url, name: product.name, price, imageURL: image });
  expect(
    scan(withoutPrice, undefined, undefined, legacy('171190375', '169420901')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(null));
  expect(
    scan(withoutPrice, undefined, undefined, legacy('169420901', '171190375')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(null));
  expect(
    scan(withoutPrice, undefined, undefined, legacy('171190375', undefined)),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(null));
  expect(
    scan(withoutPrice, undefined, other, legacy('171190375', '171190375')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(29_000));
  const displayAlongsideLegacy = (display_currency: string) => ({
    query: { catalog_product_id: '171190375' },
    props: {
      pageProps: {
        product: { id: '171190375', final_price: 29_000 },
        dehydratedState: {
          queries: [
            {
              queryKey: ['getPdpBaseInfo', '171190375'],
              state: {
                data: {
                  product: {
                    id: '171190375',
                    product_price: {
                      display_final_price: {
                        final_price: { price: 34_200, price_with_currency: { display_currency } },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
  expect(
    scan(withoutPrice, undefined, undefined, displayAlongsideLegacy('원')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(34_200));
  expect(
    scan(withoutPrice, undefined, undefined, displayAlongsideLegacy('$')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(null));
  const foreignOffer = {
    ...product,
    offers: { ...product.offers, price: 29, priceCurrency: 'USD' },
  };
  expect(
    scan([foreignOffer], undefined, undefined, legacy('171190375', '171190375')),
  ).toHaveBeenCalledExactlyOnceWith(resultWith(null));
  expect(scan([recommendation])).not.toHaveBeenCalled();
  expect(scan([], '171190375', other)).not.toHaveBeenCalled();
  const anonymous = { ...product, sku: undefined, offers: { price: 34200, priceCurrency: 'KRW' } };
  expect(scan([anonymous], '171190375', other)).not.toHaveBeenCalled();
  expect(scan([product], '171190375', other)).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ url, name: product.name, price: 34200, imageURL: image }),
  );
  const matchedCard = scan([recommendation], '171190375', url);
  vi.advanceTimersByTime(600);
  expect(matchedCard).toHaveBeenLastCalledWith(
    JSON.stringify({
      url,
      name: '공개 미리보기 제목',
      price: 34200,
      imageURL: image.replace('sample.jpeg', 'preview.jpeg'),
    }),
  );
  expect(scan([{ ...product, offers: recommendation.offers }])).not.toHaveBeenCalled();
  expect(scan([product], '169420901')).not.toHaveBeenCalled();
  expect(scan([recommendation, product])).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ url, name: product.name, price: 34200, imageURL: image }),
  );
});

it('waits for the Musinsa detail record instead of the brand-prefixed card title while streaming', () => {
  vi.useFakeTimers();
  const url = 'https://www.musinsa.com/products/02177448';
  const cover = '/images/goods_img/20211028/2177448/2177448_16353844_500.jpg';
  const page = document.implementation.createHTMLDocument();
  let loading = true;
  Object.defineProperty(page, 'readyState', { get: () => (loading ? 'loading' : 'complete') });
  page.head.innerHTML = `
    <meta property="og:title" content="얼모스트블루(ALMOSTBLUE) 블러쉬 체크 머플러 - 사이즈 &amp; 후기 | 무신사">
    <meta property="og:image" content="https://image.msscdn.net${cover}">
    <meta property="product:price:amount" content="29250">`;
  const postMessage = vi.fn<(data: string) => void>();
  const view = {
    get top() {
      return view;
    },
    ReactNativeWebView: { postMessage },
  };
  const rules: Shops = [
    {
      hosts: ['www.musinsa.com'],
      imageHosts: ['image.msscdn.net'],
      imageStrategy: 'SERVER_MIRROR',
      fields: {
        title: ["meta[property='og:title']@content", 'ldjson:name', 'title'],
        price: ["meta[property='product:price:amount']@content"],
        image: ["meta[property='og:image']@content"],
      },
    },
  ];
  new Function('window', 'location', 'document', productScanScript(rules))(
    view,
    new URL(url),
    page,
  );
  // A slow Android WebView can keep streaming the body well past the head.
  vi.advanceTimersByTime(3_000);
  const script = page.createElement('script');
  script.id = '__NEXT_DATA__';
  script.textContent = JSON.stringify({
    page: '/products/[productId]',
    query: { productId: '02177448' },
    props: {
      pageProps: {
        hasDetail: true,
        dehydratedState: {
          queries: [
            {
              queryKey: ['Detail', 2177448],
              state: {
                data: {
                  data: {
                    goodsNo: 2177448,
                    goodsNm: '블러쉬 체크 머플러',
                    goodsPrice: { salePrice: 29250, currency: 'KRW' },
                    thumbnailImageUrl: cover,
                  },
                },
              },
            },
          ],
        },
      },
    },
  });
  page.body.append(script);
  loading = false;
  vi.advanceTimersByTime(300);
  const names = postMessage.mock.calls.map(([data]) => JSON.parse(data).name);
  expect(names).toContain('블러쉬 체크 머플러');
  expect(names).not.toContain('얼모스트블루(ALMOSTBLUE) 블러쉬 체크 머플러');
});
