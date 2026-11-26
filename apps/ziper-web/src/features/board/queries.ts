import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBoard,
  deleteBoard,
  fetchBoardProducts,
  fetchBoards,
  moveProductToTrash,
  renameBoard,
  type BoardSort,
} from './api';

/**
 * 보드 쿼리 키. 모두 ['boards'] 아래에 두어서, 보드를 만들거나 바꾸면 한 번에 다시 받게 한다.
 * - list: 홈·내 보드 탭이 같이 쓰는 보드 목록
 * - products: 보드 상세의 상품 목록(정렬마다 따로)
 */
export const boardKeys = {
  all: ['boards'] as const,
  list: () => [...boardKeys.all, 'list'] as const,
  products: (boardId: number, sort: BoardSort) =>
    [...boardKeys.all, boardId, 'products', sort] as const,
};

export function useBoardsQuery() {
  return useQuery({
    queryKey: boardKeys.list(),
    queryFn: ({ signal }) => fetchBoards(signal),
  });
}

/** 보드 상세 상품. 20개씩 받고, 다음 쪽은 응답의 커서로 이어 받는다. */
export function useBoardProductsQuery(boardId: number, sort: BoardSort) {
  return useInfiniteQuery({
    queryKey: boardKeys.products(boardId, sort),
    queryFn: ({ pageParam, signal }) => fetchBoardProducts(boardId, sort, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : undefined),
  });
}

/** 보드를 만들거나 바꾸면 보드 목록·상세를 모두 다시 받는다(보드 이름이 상세 헤더에도 쓰인다). */
function useInvalidateBoards() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: boardKeys.all });
}

export function useCreateBoard() {
  const invalidate = useInvalidateBoards();
  return useMutation({ mutationFn: createBoard, onSuccess: invalidate });
}

export function useRenameBoard() {
  const invalidate = useInvalidateBoards();
  return useMutation({
    mutationFn: ({ boardId, name }: { boardId: number; name: string }) =>
      renameBoard(boardId, name),
    onSuccess: invalidate,
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boardId: number) => deleteBoard(boardId),
    onSuccess: (_, boardId) => {
      // 지운 보드의 상품 목록은 다시 받을 곳이 없으니 캐시에서 뺀다.
      queryClient.removeQueries({ queryKey: [...boardKeys.all, boardId] });
      return queryClient.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

/** 상품을 휴지통으로 보낸다. 여러 보드의 개수·썸네일이 바뀌므로 보드 쿼리를 모두 다시 받는다. */
export function useMoveProductToTrash() {
  const invalidate = useInvalidateBoards();
  return useMutation({ mutationFn: moveProductToTrash, onSuccess: invalidate });
}
