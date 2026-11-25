import { expect, it, vi } from 'vitest';
import { createShareInbox } from './inbox';
import type { SharePayload } from 'expo-sharing';

const text = (value: string): SharePayload => ({ shareType: 'text', value });
const url = (value: string): SharePayload => ({ shareType: 'url', value });

it('prefers a typed URL over text and preserves short-link parameters', () => {
  const inbox = createShareInbox();
  inbox.add([text('https://other.example'), url('https://musinsa.example/s?a=1&b=2#item')]);
  expect(inbox.read()?.url).toBe('https://musinsa.example/s?a=1&b=2#item');
});

it.each([
  ['https://www.musinsa.com/products/149708.', 'https://www.musinsa.com/products/149708'],
  ['https://zigzag.kr/catalog/products/130810007)', 'https://zigzag.kr/catalog/products/130810007'],
  ['https://m.a-bly.com/goods/12756683?option=a!', 'https://m.a-bly.com/goods/12756683?option=a!'],
  ['https://applink.a-bly.com/69ptirx.', 'https://applink.a-bly.com/69ptirx.'],
])('handles a standalone OS share like a pasted link: %s', (input, expected) => {
  const inbox = createShareInbox();
  inbox.add([url(input)]);
  expect(inbox.read()?.url).toBe(expected);
});

it('extracts the link from a shopping message and rejects unsupported payloads', () => {
  const inbox = createShareInbox();
  inbox.add([text('상품 확인 (https://example.com/item?ref=1).')]);
  expect(inbox.read()?.url).toBe('https://example.com/item?ref=1');
  inbox.dismiss(inbox.read()!.id);
  inbox.add([
    url('https://user:secret@example.com/item'),
    url('file:///etc/test'),
    text('링크 없음'),
  ]);
  expect(inbox.read()).toMatchObject({ url: null });
});

it('selects an Ably product link rather than a preceding unrelated link in a share message', () => {
  const inbox = createShareInbox();
  const product = 'https://applink.a-bly.com/69ptirx';
  inbox.add([
    text(`에이블리 이벤트 https://m.a-bly.com/events/b6929265\n상품 바로가기 (${product})`),
  ]);
  expect(inbox.read()?.url).toBe(product);
});

it('preserves a bare URL in a text share, including trailing punctuation in the URL', () => {
  const inbox = createShareInbox();
  inbox.add([text(' HTTPS://example.com/@shop?ref=track! ')]);
  expect(inbox.read()?.url).toBe('HTTPS://example.com/@shop?ref=track!');
});

it('keeps the oldest share until its ID is dismissed and wakes the consumer only when the head changes', () => {
  const inbox = createShareInbox();
  const wake = vi.fn();
  const unsubscribe = inbox.subscribe(wake);
  const first = [url('https://example.com/first')];
  inbox.add(first);
  const id = inbox.read()!.id;
  inbox.add(first);
  inbox.add([url('https://example.com/second')]);
  inbox.dismiss('stale');
  expect(inbox.read()?.id).toBe(id);
  expect(wake).toHaveBeenCalledTimes(1);
  inbox.dismiss(id);
  expect(wake).toHaveBeenCalledTimes(2);
  unsubscribe();
  inbox.add(first);
  expect(inbox.read()?.url).toBe('https://example.com/second');
  inbox.dismiss(inbox.read()!.id);
  expect(inbox.read()?.url).toBe(first[0]?.value);
  expect(inbox.read()?.id).not.toBe(id);
  expect(wake).toHaveBeenCalledTimes(2);
});
