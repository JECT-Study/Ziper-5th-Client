// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ProductSortChips } from './product-sort-chips';
import type { ProductSort } from './product-sort';

it('reveals the selected chip inside the row without moving the page', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const onChange = vi.fn();
  const geometry = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (this.tagName !== 'BUTTON') return new DOMRect(0, 0, 320, 54);
      const left = this.textContent === '가격 높은 순' ? 310 : 16;
      return new DOMRect(left - this.parentElement!.scrollLeft, 0, 98, 38);
    });
  const row = () => container.querySelector<HTMLDivElement>('[role="group"]')!;
  try {
    await act(async () => root.render(<ProductSortChips sort="PRICE_DESC" onChange={onChange} />));
    expect(row().scrollLeft).toBe(92);
    expect(row().querySelector('[aria-pressed="true"]')?.textContent).toBe('가격 높은 순');
    await act(async () => row().querySelector('button')!.click());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('RECENT');
    await act(async () => root.render(<ProductSortChips sort="RECENT" onChange={onChange} />));
    expect(row().scrollLeft).toBe(0);
  } finally {
    await act(async () => root.unmount());
    geometry.mockRestore();
  }
});

it.each([0, 1])(
  'restores focus across a sort remount only for keyboard clicks (detail=%i)',
  async (detail) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const restoreFocus: { current: ProductSort | null } = { current: null };
    const onChange = vi.fn();
    const render = (sort: ProductSort) =>
      act(() =>
        root.render(
          <ProductSortChips
            key={sort}
            sort={sort}
            onChange={onChange}
            restoreFocus={restoreFocus}
          />,
        ),
      );
    try {
      await render('RECENT');
      const chip = container.querySelector<HTMLButtonElement>('button:last-child')!;
      await act(() => {
        chip.focus();
        chip.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith('PRICE_DESC');
      await render('PRICE_DESC');
      expect(document.activeElement).toBe(
        detail === 0 ? container.querySelector('[aria-pressed="true"]') : document.body,
      );
      expect(restoreFocus.current).toBeNull();
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  },
);
