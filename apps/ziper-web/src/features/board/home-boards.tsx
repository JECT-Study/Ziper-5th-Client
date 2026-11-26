import { useGetBoards } from '@ziper/api';
import { usePlatform } from '../../bridge/provider';
import { Button } from '../../components';
import { cx } from '../../components/cx';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { BoardCard, BoardCardSkeleton } from './board-card';
import { useBoardManage } from './use-board-manage';
import { useCreateBoardSheet } from './use-create-board';
import * as styles from './board.css';

const HOME_BOARD_LIMIT = 4;

export function HomeBoards() {
  const { platform } = usePlatform();
  const boards = useGetBoards();
  const data = boards.data?.data;
  const list = data?.boards ?? [];
  const create = useCreateBoardSheet(list.map((board) => board.name));
  const manage = useBoardManage(list);
  const selectTab = useTabNavigation();

  return (
    <section aria-labelledby="home-boards-title">
      <div className={styles.homeCreate}>
        <button
          type="button"
          className={cx(styles.createButton, styles.homeCreateButton)}
          onClick={create.openSheet}
        >
          + 새 보드 만들기
        </button>
      </div>

      <div className={styles.sectionHeader}>
        <h2 id="home-boards-title" className={styles.sectionTitle}>
          내 보드
        </h2>
        <button type="button" className={styles.sectionLink} onClick={() => selectTab('board')}>
          전체 보기
        </button>
      </div>

      {boards.isError && !data ? (
        <div className={styles.status}>
          <p role="alert">보드를 불러오지 못했어요.</p>
          <Button variant="secondary" size="small" onClick={() => void boards.refetch()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <div className={styles.homeList} aria-busy={boards.isPending}>
          {!data && (
            <>
              <BoardCardSkeleton />
              <BoardCardSkeleton />
            </>
          )}
          {list.slice(0, HOME_BOARD_LIMIT).map((board) => (
            <BoardCard
              key={board.boardId}
              name={board.name}
              productCount={board.productCount}
              previewImages={board.previewImages}
              onOpen={() =>
                void platform.navigation.push(`/boards/${board.boardId}`).catch(() => {})
              }
              onMore={() => manage.open(board)}
            />
          ))}
        </div>
      )}

      {create.sheet}
      {manage.element}
    </section>
  );
}
