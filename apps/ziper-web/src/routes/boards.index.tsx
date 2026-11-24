import { createFileRoute } from '@tanstack/react-router';
import { requireSignedIn } from '../features/auth';
import { BoardsScreen } from '../features/board';

export const Route = createFileRoute('/boards/')({
  // 로그인 여부는 브라우저에서만 확인할 수 있다.
  ssr: false,
  beforeLoad: requireSignedIn,
  head: () => ({ meta: [{ title: '내 보드 | Ziper' }] }),
  component: BoardsScreen,
});
