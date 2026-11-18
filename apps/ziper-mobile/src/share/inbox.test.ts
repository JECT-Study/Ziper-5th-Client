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
