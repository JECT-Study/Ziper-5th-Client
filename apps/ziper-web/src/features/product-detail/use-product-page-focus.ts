import { useEffect, useRef, type MouseEvent } from 'react';

export function useProductPageFocus(status: 'loading' | 'ready' | 'error', count: number) {
  const grid = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLDivElement>(null);
  const empty = useRef<HTMLParagraphElement>(null);
  const focusIndex = useRef<number | null>(null);

  function pageAction(event: MouseEvent<HTMLButtonElement>, action: () => void, restart = false) {
    if (event.detail === 0) {
      focusIndex.current = restart ? 0 : count;
      pager.current?.focus({ preventScroll: true });
    }
    action();
  }

  useEffect(() => {
    const index = focusIndex.current;
    if (index === null || status === 'loading') return;
    focusIndex.current = null;
    const area = pager.current;
    // Don't pull the reader back if they moved to another control while loading.
    if (!area || area.ownerDocument.activeElement !== area) return;
    const nextCard = status === 'ready' ? grid.current?.children[index] : null;
    const target =
      nextCard?.querySelector<HTMLButtonElement>('button:not(:disabled)') ??
      area.querySelector('button') ??
      empty.current ??
      grid.current?.lastElementChild?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    target?.focus();
  }, [status]);

  return { grid, pager, empty, pageAction };
}
