import { createFileRoute, notFound } from '@tanstack/react-router';
import { BoardDetailScreen } from '../../../features/board';

export const Route = createFileRoute('/_app/boards/$boardId')({
  params: {
    parse: ({ boardId }) => {
      const id = Number(boardId);
      if (!Number.isSafeInteger(id) || id <= 0) throw notFound();
      return { boardId: id };
    },
    stringify: ({ boardId }) => ({ boardId: String(boardId) }),
  },
  // created=1: 방금 만든 보드. 상세가 "만들었어요" 토스트를 띄운다.
  // 검색 값은 한 번 거른 결과(true)로 다시 걸러지기도 해서 true 도 받는다.
  validateSearch: (search: Record<string, unknown>) => ({
    created: [true, 1, '1', 'true'].includes(search.created as never) ? true : undefined,
  }),
  head: () => ({ meta: [{ title: '보드 | Ziper' }] }),
  component: BoardDetailRoute,
});

function BoardDetailRoute() {
  const { boardId } = Route.useParams();
  const { created } = Route.useSearch();
  const navigate = Route.useNavigate();
  // 보드를 옮겨 다닐 때 이전 보드의 목록·정렬이 남지 않도록 보드마다 새로 그린다.
  return (
    <BoardDetailScreen
      key={boardId}
      boardId={boardId}
      created={created === true}
      // 알린 뒤에는 주소에서 지워서, 새로고침해도 다시 뜨지 않게 한다.
      onCreatedShown={() => void navigate({ search: { created: undefined }, replace: true })}
    />
  );
}
