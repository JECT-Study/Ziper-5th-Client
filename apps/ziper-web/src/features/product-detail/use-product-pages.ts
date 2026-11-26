import { useRef, useState } from 'react';
import { ApiError } from '../../shared/api/http';
import { invalidResponse } from '../../shared/api/response';
import { useLoad } from '../../shared/use-load';

type Page = { items: readonly { cardId: number | string }[]; nextCursor: string | null };

/** Mount with a key for each list and sort, so an old page cannot replace the new list. */
export function useProductPages<T extends Page>(
  load: (signal: AbortSignal, cursor: string | undefined) => Promise<T>,
  revision = 0,
) {
  const [result, setResult] = useState<{ page: T; revision: number } | null>(null);
  const [next, setNext] = useState<{ cursor: string; revision: number }>();
  const cursor = next?.revision === revision ? next.cursor : undefined;
  const completed = useRef(new Set<string>());
  const [loaded, retry] = useLoad(
    async (signal) => {
      const next = await load(signal, cursor);
      if (
        next.nextCursor !== null &&
        (!next.nextCursor ||
          next.nextCursor === cursor ||
          (cursor !== undefined && completed.current.has(next.nextCursor)))
      ) {
        invalidResponse();
      }
      return next;
    },
    [cursor, revision],
    {
      timeoutMs: 10_000,
      onReady(next) {
        if (cursor === undefined) completed.current.clear();
        else completed.current.add(cursor);
        setResult((previous) => {
          const oldItems = cursor === undefined ? [] : previous?.page.items;
          const map = new Map(oldItems?.map((item) => [item.cardId, item]));
          for (const item of next.items) map.set(item.cardId, item);
          return { revision, page: { ...next, items: [...map.values()] } };
        });
      },
    },
  );
  const page = result?.page ?? null;
  const nextCursor = page?.nextCursor;
  const canLoadMore =
    loaded.status === 'ready' && result?.revision === revision && Boolean(nextCursor);
  const error = loaded.status === 'error' ? loaded.error : undefined;
  const rejectedCursor =
    cursor !== undefined &&
    error instanceof ApiError &&
    error.status === 400 &&
    (error.code === 'INVALID_REQUEST' || error.code === 'INVALID_CURSOR');
  return {
    page,
    refreshing:
      result !== null && (result.revision !== revision || (!cursor && loaded.status !== 'ready')),
    rejectedCursor,
    status: loaded.status,
    error,
    canLoadMore,
    loadMore: () => {
      if (canLoadMore && nextCursor) setNext({ cursor: nextCursor, revision });
    },
    retry: () => {
      if (rejectedCursor) setNext(undefined);
      retry();
    },
  };
}
