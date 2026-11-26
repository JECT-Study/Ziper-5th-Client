// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { deferred } from '../../../../../packages/bridge/test/deferred';
import { ApiError } from '../../shared/api/http';
import { useProductPages } from './use-product-pages';

type Page = { items: { cardId: number; title: string }[]; nextCursor: string | null };
const first: Page = { items: [{ cardId: 1, title: 'First' }], nextCursor: 'two' };
const second: Page = {
  items: [
    { cardId: 1, title: 'Updated' },
    { cardId: 2, title: 'Second' },
  ],
  nextCursor: null,
};

it('retries the failed cursor without discarding the first page or duplicating overlapping items', async () => {
  const load = vi
    .fn<(signal: AbortSignal, cursor?: string) => Promise<Page>>()
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(second);
  const el = document.createElement('div');
  const root = createRoot(el);
  let pages!: ReturnType<typeof useProductPages<Page>>;
  function List() {
    pages = useProductPages(load);
    return null;
  }
  try {
    await act(async () => root.render(<List />));
    await act(async () => pages.loadMore());
    expect(pages.status).toBe('error');
    expect(pages.page).toEqual(first);
    await act(async () => pages.retry());
    expect(load.mock.calls.map(([, cursor]) => cursor)).toEqual([undefined, 'two', 'two']);
    expect(pages.page).toEqual(second);
    expect(pages.canLoadMore).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

it.each(['INVALID_REQUEST', 'INVALID_CURSOR'])(
  'discards a rejected cursor (%s) without clearing the cards on a failed refresh',
  async (code) => {
    const reset = { items: [first.items[0]!], nextCursor: 'fresh' };
    const load = vi
      .fn<(signal: AbortSignal, cursor?: string) => Promise<Page>>()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new ApiError(400, code))
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValueOnce(reset)
      .mockResolvedValueOnce(second);
    const root = createRoot(document.createElement('div'));
    let pages!: ReturnType<typeof useProductPages<Page>>;
    function List() {
      pages = useProductPages(load);
      return null;
    }
    try {
      await act(async () => root.render(<List />));
      await act(async () => pages.loadMore());
      expect(pages.rejectedCursor).toBe(true);
      expect(pages.page).toEqual(first);
      await act(async () => pages.retry());
      expect(pages.refreshing).toBe(true);
      expect(pages.rejectedCursor).toBe(false);
      expect(pages.page).toEqual(first);
      await act(async () => pages.retry());
      await act(async () => pages.loadMore());
      expect(load.mock.calls.map(([, cursor]) => cursor)).toEqual([
        undefined,
        'two',
        undefined,
        undefined,
        'fresh',
      ]);
      expect(pages.page).toEqual(second);
    } finally {
      await act(async () => root.unmount());
    }
  },
);

it('stops a cursor cycle at the bad page and retries without adding its items', async () => {
  const load = vi
    .fn<(signal: AbortSignal, cursor?: string) => Promise<Page>>()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce({ ...second, nextCursor: 'three' })
    .mockResolvedValueOnce({ items: [{ cardId: 3, title: 'Invalid' }], nextCursor: 'two' })
    .mockResolvedValueOnce({ items: [{ cardId: 3, title: 'Third' }], nextCursor: null });
  const root = createRoot(document.createElement('div'));
  let pages!: ReturnType<typeof useProductPages<Page>>;
  function List() {
    pages = useProductPages(load);
    return null;
  }
  try {
    await act(async () => root.render(<List />));
    await act(async () => pages.loadMore());
    await act(async () => pages.loadMore());
    expect(pages.status).toBe('error');
    expect(pages.page?.items).toEqual(second.items);
    expect(pages.canLoadMore).toBe(false);
    await act(async () => pages.retry());
    expect(load.mock.calls.map(([, cursor]) => cursor)).toEqual([
      undefined,
      'two',
      'three',
      'three',
    ]);
    expect(pages.page?.items.map(({ title }) => title)).toEqual(['Updated', 'Second', 'Third']);
    expect(pages.canLoadMore).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});

it('cancels a late next page when the board or sort changes', async () => {
  const pending = deferred<Page>();
  const load = vi
    .fn<(signal: AbortSignal, cursor?: string) => Promise<Page>>()
    .mockResolvedValueOnce(first)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(second);
  const el = document.createElement('div');
  const root = createRoot(el);
  let pages!: ReturnType<typeof useProductPages<Page>>;
  function List() {
    pages = useProductPages(load);
    return null;
  }
  try {
    await act(async () => root.render(<List key="asc" />));
    await act(async () => pages.loadMore());
    const oldSignal = load.mock.calls[1]![0];
    await act(async () => root.render(<List key="desc" />));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => pending.resolve(first));
    expect(pages.page).toEqual(second);
  } finally {
    await act(async () => root.unmount());
  }
});

it('refreshes from the first page after a visit and never continues an old cursor', async () => {
  const pending = deferred<Page>();
  const refreshed = { items: [{ cardId: 3, title: 'Moved' }], nextCursor: 'two' };
  const load = vi
    .fn<(signal: AbortSignal, cursor?: string) => Promise<Page>>()
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce({ ...second, nextCursor: 'three' })
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new ApiError(503))
    .mockResolvedValueOnce(refreshed)
    .mockResolvedValueOnce({ items: first.items, nextCursor: null });
  const root = createRoot(document.createElement('div'));
  let pages!: ReturnType<typeof useProductPages<Page>>;
  function List({ revision }: { revision: number }) {
    pages = useProductPages(load, revision);
    return null;
  }

  try {
    await act(async () => root.render(<List revision={0} />));
    await act(async () => pages.loadMore());
    await act(async () => pages.loadMore());
    await act(async () => root.render(<List revision={1} />));
    expect(load.mock.calls[2]![0].aborted).toBe(true);
    await act(async () => pending.resolve(first));
    expect(pages.status).toBe('error');
    expect(pages.page?.items).toEqual(second.items);
    expect(pages.canLoadMore).toBe(false);

    await act(async () => pages.retry());
    expect(pages.page).toEqual(refreshed);
    expect(pages.canLoadMore).toBe(true);
    await act(async () => pages.loadMore());
    expect(pages.page?.items).toEqual([...refreshed.items, ...first.items]);
    expect(load.mock.calls.map(([, cursor]) => cursor)).toEqual([
      undefined,
      'two',
      'three',
      undefined,
      undefined,
      'two',
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});
