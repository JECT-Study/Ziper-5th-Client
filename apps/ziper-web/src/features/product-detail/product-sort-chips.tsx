import { useEffect, useRef, type RefObject } from 'react';
import { ChipFilter } from '../../components/ChipFilter';
import { productSortLabels, productSorts, type ProductSort } from './product-sort';
import { sorts } from '../board/board-detail.css';

export function ProductSortChips({
  sort,
  onChange,
  restoreFocus,
}: {
  sort: ProductSort;
  onChange: (sort: ProductSort) => void;
  /** Keep keyboard focus across the board's sort-keyed remount. */
  restoreFocus?: RefObject<ProductSort | null>;
}) {
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const chip = selected.current;
    const row = chip?.parentElement;
    if (!chip || !row) return;
    if (restoreFocus?.current) {
      const requested = restoreFocus.current;
      restoreFocus.current = null;
      if (requested === sort) chip.focus({ preventScroll: true });
    }
    // Scroll only this row. The route owns the page's vertical scroll restoration.
    if (sort === 'RECENT') {
      row.scrollLeft = 0;
      return;
    }
    const { left, right } = row.getBoundingClientRect();
    const rect = chip.getBoundingClientRect();
    // Leave room for ChipFilter's 2px outline and its 2px offset.
    row.scrollLeft +=
      rect.left < left + 4 ? rect.left - left - 4 : Math.max(0, rect.right - right + 4);
  }, [sort, restoreFocus]);

  return (
    <div className={sorts} role="group" aria-label="상품 정렬">
      {productSorts.map((option) => (
        <ChipFilter
          key={option}
          ref={sort === option ? selected : undefined}
          selected={sort === option}
          onClick={(event) => {
            if (restoreFocus && option !== sort) {
              restoreFocus.current = event.detail === 0 ? option : null;
            }
            onChange(option);
          }}
        >
          {productSortLabels[option]}
        </ChipFilter>
      ))}
    </div>
  );
}
