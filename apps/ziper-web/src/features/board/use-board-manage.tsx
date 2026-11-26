import { getGetBoardsQueryKey, useDeleteBoard, useRenameBoard } from '@ziper/api';
import { ApiError, errorMessage } from '@ziper/api/http';
import type { BoardSummaryResponse as Board } from '@ziper/api/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BottomSheet, Button, Modal, showToast } from '../../components';
import { cx } from '../../components/cx';
import { useBackLayer } from '../../shared/use-back-layer';
import { BoardNameSheet } from './board-name-sheet';
import * as styles from './board.css';

type Step = 'menu' | 'rename' | 'delete';

export function useBoardManage(boards: readonly Board[]) {
  const queryClient = useQueryClient();
  const mutation = {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBoardsQueryKey() }),
  };
  const renameBoard = useRenameBoard({ mutation });
  const deleteBoard = useDeleteBoard({ mutation });
  const [target, setTarget] = useState<{ board: Board; step: Step } | null>(null);
  const deleting = deleteBoard.isPending;
  const close = () => setTarget(null);

  // 메뉴 → 수정·삭제 단계를 history 한 칸으로 묶어야 뒤로 가기가 다음 단계를 닫지 않는다.
  useBackLayer(target !== null, () => {
    if (!deleting) close();
  });

  function open(board: Board) {
    if (!board.modifiable) {
      showToast('기본 보드는 수정하거나 삭제할 수 없어요');
      return;
    }
    setTarget({ board, step: 'menu' });
  }

  async function rename(name: string) {
    if (!target) return 'failed' as const;
    try {
      await renameBoard.mutateAsync({ boardId: target.board.boardId, data: { name } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return 'duplicate' as const;
      showToast(errorMessage(error, '보드 이름을 바꾸지 못했어요. 다시 시도해 주세요.'));
      return 'failed' as const;
    }
    close();
    showToast('보드 이름을 바꿨어요');
    return 'done' as const;
  }

  async function remove() {
    if (!target || deleting) return;
    const { board } = target;
    try {
      await deleteBoard.mutateAsync({ boardId: board.boardId });
      close();
      showToast(`${board.name} 보드를 삭제했어요`);
    } catch (error) {
      showToast(errorMessage(error, '보드를 삭제하지 못했어요. 다시 시도해 주세요.'));
    }
  }

  const board = target?.board;
  const element = (
    <>
      <BottomSheet
        open={target?.step === 'menu'}
        title="보드 관리"
        showClose={false}
        onClose={close}
        footer={
          <div className={styles.sheetFooter}>
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
          </div>
        }
      >
        <div className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => board && setTarget({ board, step: 'rename' })}
          >
            보드명 수정
          </button>
          <button
            type="button"
            className={cx(styles.menuItem, styles.menuItemDanger)}
            onClick={() => board && setTarget({ board, step: 'delete' })}
          >
            보드 삭제
          </button>
        </div>
      </BottomSheet>

      <BoardNameSheet
        open={target?.step === 'rename'}
        title="보드명 수정"
        submitLabel="수정완료"
        initialName={board?.name}
        takenNames={boards.filter((b) => b.boardId !== board?.boardId).map((b) => b.name)}
        onClose={close}
        onSubmit={rename}
        backLayer={false}
      />

      <Modal
        open={target?.step === 'delete'}
        title={`${board?.name ?? ''} 보드를 삭제할까요?`}
        description={
          '다른 보드에 담긴 상품은 그대로 남아요.\n이 보드에만 담긴 상품은\n휴지통에 30일 동안 보관돼요.'
        }
        onClose={() => !deleting && close()}
        actions={
          <>
            <Button variant="secondary" onClick={close} disabled={deleting}>
              취소
            </Button>
            <Button onClick={() => void remove()} loading={deleting}>
              삭제하기
            </Button>
          </>
        }
      />
    </>
  );

  return { open, element };
}
