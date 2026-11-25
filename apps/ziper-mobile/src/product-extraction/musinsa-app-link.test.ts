import { expect, it } from 'vitest';
import { musinsaAppProductURL } from './musinsa-app-link';

const product = 'https://www.musinsa.com/products/4804589';
const target = (link: string) => `musinsaad://web?link=${encodeURIComponent(link)}`;

it('resolves only the OneLink app target for an HTTPS Musinsa product', () => {
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
