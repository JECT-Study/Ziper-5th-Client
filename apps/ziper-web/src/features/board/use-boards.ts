import { useCallback, useEffect, useState } from 'react';
import { fetchBoards, type BoardList } from './api';

type BoardsState =
  | { status: 'loading'; data: BoardList | null }
  | { status: 'ready'; data: BoardList }
  | { status: 'error'; data: BoardList | null };

/** 보드 목록을 불러온다. reload 하는 동안에는 이전 목록을 그대로 보여준다. */
export function useBoards() {
  const [state, setState] = useState<BoardsState>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ status: 'loading', data: prev.data }));
    fetchBoards().then(
      (data) => alive && setState({ status: 'ready', data }),
      () => alive && setState((prev) => ({ status: 'error', data: prev.data })),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
