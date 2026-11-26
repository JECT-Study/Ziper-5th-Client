// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ProductCard } from './product-card';

it.each(['AVAILABLE', 'UNKNOWN', 'SOLD_OUT', 'REMOVED'] as const)(
  'shows the link state %s without replacing the purchase status',
  async (linkStatus) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onOpenOriginal = vi.fn();
    try {
      await act(() =>
        root.render(
          <ProductCard
            product={{
              linkStatus,
              imageUrl: null,
              imageFileUrl: null,
              fallbackIcon: 'TOP',
              productTitle: '테스트 상품',
              shop: null,
              price: 39_000,
              tags: ['가을'],
            }}
            purchased
            onOpenOriginal={onOpenOriginal}
          />,
        ),
      );
      const chips = Array.from(container.querySelectorAll('li'), (item) => item.textContent);
      expect(chips).toEqual(
        linkStatus === 'SOLD_OUT' ? ['가을', '구매 완료', '품절'] : ['가을', '구매 완료'],
      );
      const original = [...container.querySelectorAll('button')].find((item) =>
        item.textContent?.startsWith('원본 '),
      )!;
      const removed = linkStatus === 'REMOVED';
      expect(original.textContent).toBe(removed ? '원본 상품 접근불가' : '원본 쇼핑몰로 이동');
      expect(original.disabled).toBe(removed);
      await act(() => original.click());
      expect(onOpenOriginal).toHaveBeenCalledTimes(removed ? 0 : 1);
    } finally {
      await act(() => root.unmount());
    }
  },
);
