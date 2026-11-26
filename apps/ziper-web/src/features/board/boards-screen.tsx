import { useNavigate } from '@tanstack/react-router';
import { useGetBoards } from '@ziper/api';
import type { BoardSummaryResponse } from '@ziper/api/schemas';
import { useState } from 'react';
import { usePlatform } from '../../bridge/provider';
import { BottomNavigation, Button, ChipFilter, HeaderSub, showToast } from '../../components';
import { cx } from '../../components/cx';
import { purchasesEnabled } from '../product-detail/purchases';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { BoardCard, BoardCardSkeleton } from './board-card';
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

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const isRecent = (board: BoardSummaryResponse, now: number) =>
  now - board.createdAt.getTime() <= RECENT_MS;

export function BoardsScreen() {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const navigate = useNavigate();
  const boards = useGetBoards();
  const data = boards.data?.data;
  const [filter, setFilter] = useState<Filter>('all');
  const list = data?.boards ?? [];
  const create = useCreateBoardSheet(list.map((board) => board.name));
  const manage = useBoardManage(list);

  const now = Date.now();
  const shown =
    filter === 'all' ? list : filter === 'recent' ? list.filter((b) => isRecent(b, now)) : [];
  const purchased = data?.purchasedSummary;

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

        {boards.isError && !data ? (
          <div className={styles.status}>
            <p role="alert">보드를 불러오지 못했어요.</p>
            <Button variant="secondary" size="small" onClick={() => void boards.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : (
          <div className={styles.tabGrid} aria-busy={!data}>
            {!data && (
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
                // TODO: 구매 완료 목록 API(JEC-79)가 배포되면 purchasesEnabled 를 켠다.
                onOpen={() =>
                  purchasesEnabled
                    ? void navigate({ to: '/products/purchased', search: { sort: undefined } })
                    : showToast('구매 완료 목록은 준비 중이에요')
                }
                onMore={() => showToast('구매 완료 목록은 수정하거나 삭제할 수 없어요')}
              />
            )}
            {data && filter === 'recent' && shown.length === 0 && (
              <p className={styles.empty}>최근 7일 안에 만든 보드가 없어요</p>
            )}
            {data && filter !== 'purchased' && (
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
