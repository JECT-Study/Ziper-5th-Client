import { useState } from 'react';
import { usePlatform } from '../../bridge/provider';
import { BottomNavigation, Button, ChipFilter, HeaderSub, showToast } from '../../components';
import { cx } from '../../components/cx';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import type { Board } from './api';
import { BoardCard, BoardCardSkeleton } from './board-card';
import { useBoards } from './use-boards';
import { useBoardManage } from './use-board-manage';
import { useCreateBoardSheet } from './use-create-board';
import * as styles from './board.css';
import * as page from './board-detail.css';

type Filter = 'all' | 'recent' | 'purchased';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'recent', label: '최근' },
  { value: 'purchased', label: '구매 완료' },
];

// "최근" 칩은 최근 7일 안에 만든 보드만 보여준다.
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const isRecent = (board: Board, now: number) => now - Date.parse(board.createdAt) <= RECENT_MS;

/** 하단 "보드" 탭: 내 보드 전체를 2열로 보여준다. */
export function BoardsScreen() {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const boards = useBoards();
  const [filter, setFilter] = useState<Filter>('all');
  const list = boards.data?.boards ?? [];
  const create = useCreateBoardSheet(list.map((board) => board.name));
  const manage = useBoardManage(list, boards.reload);

  const now = Date.now();
  const shown =
    filter === 'all' ? list : filter === 'recent' ? list.filter((b) => isRecent(b, now)) : [];
  const purchased = boards.data?.purchasedSummary;

  const openBoard = (boardId: number) =>
    void platform.navigation.push(`/boards/${boardId}`).catch(() => {});

  return (
    <main className={page.page}>
      <HeaderSub title="내 보드" className={styles.tabHeader} />
      <div className={page.body}>
        <div className={styles.filters}>
          {FILTERS.map((option) => (
            <ChipFilter
              key={option.value}
              selected={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </ChipFilter>
          ))}
        </div>

        {boards.status === 'error' && !boards.data ? (
          <div className={styles.status}>
            <p role="alert">보드를 불러오지 못했어요.</p>
            <Button variant="secondary" size="small" onClick={boards.reload}>
              다시 시도
            </Button>
          </div>
        ) : (
          <div className={styles.tabGrid} aria-busy={!boards.data}>
            {!boards.data && (
              <>
                <BoardCardSkeleton />
                <BoardCardSkeleton />
              </>
            )}
            {shown.map((board) => (
              <BoardCard
                key={board.boardId}
                name={board.name}
                productCount={board.productCount}
                previewImages={board.previewImages}
                onOpen={() => openBoard(board.boardId)}
                onMore={() => manage.open(board)}
              />
            ))}
            {purchased && filter !== 'recent' && (
              <BoardCard
                name="구매 완료"
                productCount={purchased.productCount}
                previewImages={purchased.previewImages}
                // TODO: 구매 완료 목록 API(JEC-79)가 나오면 목록 화면으로 연결한다.
                onOpen={() => showToast('구매 완료 목록은 준비 중이에요')}
                onMore={() => showToast('구매 완료 목록은 수정하거나 삭제할 수 없어요')}
              />
            )}
            {boards.data && filter === 'recent' && shown.length === 0 && (
              <p className={styles.empty}>최근 7일 안에 만든 보드가 없어요</p>
            )}
            {boards.data && filter !== 'purchased' && (
              <button
                type="button"
                className={cx(styles.createButton, styles.tabCreateButton)}
                onClick={create.openSheet}
              >
                + 새 보드 만들기
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNavigation
        active="board"
        onSelect={selectTab}
        onAdd={
          status === 'initializing'
            ? undefined
            : () => void platform.navigation.push('/register-product').catch(() => {})
        }
      />
      {create.sheet}
      {manage.element}
    </main>
  );
}
