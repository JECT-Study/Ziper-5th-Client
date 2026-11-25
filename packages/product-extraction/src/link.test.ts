import { expect, it } from 'vitest';
import {
  alternateProductExtractionURL,
  canonicalProductExtractionURL,
  findSharedURL,
  isProductExtractionURL,
  productShortLinkShop,
  musinsaAppProductURL,
} from './link';
import { productMetadata } from './schema';

const ably = 'https://applink.a-bly.com/69ptirx';
const product = 'https://m.a-bly.com/goods/51978009';

it('prefers a product URL, then a known short link, in pasted shopping messages', () => {
  expect(findSharedURL(`https://m.a-bly.com/events/sample 상품 (${ably}).`)).toBe(ably);
  expect(findSharedURL(`공유: ${ably}\n상품 페이지: ${product}`)).toBe(product);
  expect(findSharedURL('https://example.org/other')).toBe('https://example.org/other');
  expect(findSharedURL('잘못된 주소: https://user:password@example.org/item')).toBeNull();
});

it.each([
  ['https://zigzag.kr/catalog/products/135858160', '.'],
  ['https://www.musinsa.com/products/338418', ')'],
  [product, '。'],
])('recovers a pasted direct product URL with trailing prose punctuation: %s', (url, suffix) => {
  expect(findSharedURL(url + suffix)).toBe(url);
  expect(findSharedURL(`${url}?option=black${suffix}`)).toBe(`${url}?option=black${suffix}`);
});

it.each([
  [`상품 링크: “${product}”입니다.`, product],
  [`상품 링크: ‘${product}’`, product],
  [`공유: <${product}?coupon_sno=44495066!>`, `${product}?coupon_sno=44495066!`],
  [`공유: ${product}?coupon_sno=44495066!`, `${product}?coupon_sno=44495066!`],
  [`공유: (${product}?option=(A)!).`, `${product}?option=(A)!`],
  [`공유: [${product}?coupon_sno=44495066].`, `${product}?coupon_sno=44495066`],
  [`공유: ${product}/.`, `${product}/`],
  [`공유: "${ably}."`, `${ably}.`],
  [`‘${ably}’ 다음: “${product}?option=(A)”`, `${product}?option=(A)`],
  ['공유: <https://user:password@m.a-bly.com/goods/7>', null],
] as const)(
  'distinguishes message punctuation from product URL characters: %s',
  (text, expected) => {
    expect(findSharedURL(text)).toBe(expected);
  },
);

it('leaves standalone short and unsupported URLs unchanged', () => {
  expect(findSharedURL(`${ably}.`)).toBe(`${ably}.`);
  expect(findSharedURL('https://example.org/item.')).toBe('https://example.org/item.');
});

it('normalizes the Ably app-facing product URL without accepting other app routes', () => {
  expect(canonicalProductExtractionURL('https://a-bly.com/app/goods/51978009')).toBe(product);
  expect(canonicalProductExtractionURL('https://a-bly.com/app/goods/51978009/other')).toBeNull();
  expect(canonicalProductExtractionURL('https://a-bly.com/app/events/51978009')).toBeNull();
  const app = 'https://a-bly.com/app/goods/51978009';
  expect(alternateProductExtractionURL(app)).toBe(product);
  const offer = `${app}?coupon_sno=44495066&option=a%2Bb`;
  expect(alternateProductExtractionURL(offer)).toBeNull(); // Follow the shop's HTTPS redirect.
  expect(alternateProductExtractionURL(offer.replace('https:', 'http:'))).toBe(offer);
  expect(canonicalProductExtractionURL(offer)).toBe(product);
});

it.each([
  'https://a-bly.com/app/goods/%35462175',
  'https://www.a-bly.com/app/goods/5462175',
  'https://a-bly.com./app/goods/5462175',
])('follows the retailer redirect for offer-bearing Ably app aliases: %s', (alias) => {
  const canonical = 'https://m.a-bly.com/goods/5462175';
  const offer = `${alias}?coupon_sno=44495066&option=a%2Bb`;
  expect(canonicalProductExtractionURL(offer)).toBe(canonical);
  const secure = offer.replace('a-bly.com./', 'a-bly.com/');
  expect(alternateProductExtractionURL(offer)).toBe(secure === offer ? null : secure);
  expect(alternateProductExtractionURL(offer.replace('https:', 'http:'))).toBe(secure);
  expect(alternateProductExtractionURL(alias)).toBe(canonical);
});

it.each([
  ['http://zigzag.kr/catalog/products/169420901', 'https://zigzag.kr/catalog/products/169420901'],
  ['https://www.musinsa.com/%70roducts/480458%39', 'https://www.musinsa.com/products/4804589'],
  ['https://m.a-bly.com./goods/51978009', product],
])('loads a known product alias at its canonical HTTPS URL: %s', (input, expected) => {
  expect(canonicalProductExtractionURL(input)).toBe(expected);
  expect(alternateProductExtractionURL(input)).toBe(expected);
  expect(isProductExtractionURL(input, true)).toBe(true);
});

it.each([
  'https://m.a-bly.com/goods/%35462175',
  'http://m.a-bly.com/goods/5462175',
  'https://m.a-bly.com./goods/5462175',
  'https://mobile.a-bly.com/goods/%35462175',
  'https://a-bly.com/goods/%35462175',
  'https://www.a-bly.com/goods/%35462175',
  'http://a-bly.com/goods/5462175',
])('keeps the displayed offer on same-host PDP normalization: %s', (alias) => {
  const canonical = 'https://m.a-bly.com/goods/5462175';
  const search = '?coupon_sno=44495066&option=a%2Bb';
  const navigationHost = new URL(alias).hostname.replace(/\.$/, '');
  expect(alternateProductExtractionURL(alias + search)).toBe(
    `https://${navigationHost}/goods/5462175${search}`,
  );
  expect(canonicalProductExtractionURL(alias + search)).toBe(canonical);
});

it('keeps the submitted offer URL but uses each shop’s canonical spelling for a padded ID', () => {
  const offer = 'https://m.a-bly.com/goods/014012960?coupon_sno=45920189';
  expect(alternateProductExtractionURL(offer)).toBeNull();
  expect(canonicalProductExtractionURL(offer)).toBe('https://m.a-bly.com/goods/14012960');
  for (const url of [
    'https://www.musinsa.com/products/02177448',
    'https://zigzag.kr/catalog/products/0113602661',
  ]) {
    expect(alternateProductExtractionURL(url)).toBeNull();
    expect(canonicalProductExtractionURL(url)).toBe(url);
  }
});

it('does not widen navigation to unknown or insecure redirect hosts', () => {
  for (const value of [
    'http://s.zigzag.kr/abr/example',
    'http://applink.a-bly.com/69ptirx',
    'http://www.musinsa.com:8080/products/4804589',
    'https://a-bly.com/app/goods/%2F5462175',
    'https://a-bly.com/app/goods/%2535462175',
    'https://www.a-bly.com.example.org/app/goods/5462175',
    'https://a-bly.com/%61pp/goods/5462175',
    'https://m.a-bly.com/goods%2F51978009',
    'https://m.a-bly.com/goods/51978009%2F8',
    'https://m.a-bly.com.example.org/goods/51978009',
  ])
    expect(isProductExtractionURL(value, true)).toBe(false);
  expect(alternateProductExtractionURL(product + '?utm_source=share')).toBeNull();
  expect(alternateProductExtractionURL('http://store.musinsa.com/app/goods/7?from=old')).toBe(
    'https://www.musinsa.com/products/7',
  );
  expect(
    productMetadata.safeParse({
      url: product.replace('https:', 'http:'),
      name: '',
      price: null,
      imageURL: null,
    }).success,
  ).toBe(false);
});

it('accepts only the exact Ably shortener host for navigation, not as an extracted product', () => {
  expect(productShortLinkShop(ably)).toBe('m.a-bly.com');
  expect(isProductExtractionURL(ably, true)).toBe(true);
  expect(isProductExtractionURL(ably)).toBe(false);
  expect(isProductExtractionURL('https://applink.a-bly.com.example.org/69ptirx', true)).toBe(false);
});

it('resolves only the OneLink app target for an HTTPS Musinsa product', () => {
  const product = 'https://www.musinsa.com/products/4804589';
  const target = (link: string) => `musinsaad://web?link=${encodeURIComponent(link)}`;
  expect(musinsaAppProductURL(target(`${product}?utm_source=share`))).toBe(product);
  expect(musinsaAppProductURL(target(product.replace('https:', 'http:')))).toBeNull();
  expect(musinsaAppProductURL(target('https://www.musinsa.com/brand/astorflex'))).toBeNull();
  expect(musinsaAppProductURL(target('https://m.a-bly.com/goods/51978009'))).toBeNull();
  expect(
    musinsaAppProductURL(target(product.replace('www.musinsa.com', 'www.musinsa.com.example.org'))),
  ).toBeNull();
  expect(musinsaAppProductURL(target(product) + '&link=' + encodeURIComponent(product))).toBeNull();
  expect(
    musinsaAppProductURL(target(product).replace('musinsaad://web', 'musinsaad://other')),
  ).toBeNull();
});
