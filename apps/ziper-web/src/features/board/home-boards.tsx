import { usePlatform } from '../../bridge/provider';
import { Button } from '../../components';
import { cx } from '../../components/cx';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { BoardCard, BoardCardSkeleton } from './board-card';
import { useBoards } from './use-boards';
import { useBoardManage } from './use-board-manage';
import { useCreateBoardSheet } from './use-create-board';
import * as styles from './board.css';

/** 홈 화면의 보드 영역: 새 보드 만들기 + 내 보드 가로 목록 */
export function HomeBoards() {
  const { platform } = usePlatform();
  const boards = useBoards();
  const list = boards.data?.boards ?? [];
  const create = useCreateBoardSheet(list.map((board) => board.name));
  const manage = useBoardManage(list, boards.reload);
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

      {boards.status === 'error' && !boards.data ? (
        <div className={styles.status}>
          <p role="alert">보드를 불러오지 못했어요.</p>
          <Button variant="secondary" size="small" onClick={boards.reload}>
            다시 시도
          </Button>
        </div>
      ) : (
        <div className={styles.homeList} aria-busy={boards.status === 'loading' && !boards.data}>
          {!boards.data && (
            <>
              <BoardCardSkeleton className={styles.homeCard} />
              <BoardCardSkeleton className={styles.homeCard} />
            </>
          )}
          {list.map((board) => (
            <BoardCard
              key={board.boardId}
              className={styles.homeCard}
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
