import { createFileRoute } from '@tanstack/react-router';
import { BoardsScreen } from '../../../../features/board';

export const Route = createFileRoute('/_app/(tabs)/boards/')({
  head: () => ({ meta: [{ title: '내 보드 | Ziper' }] }),
  component: BoardsScreen,
});
