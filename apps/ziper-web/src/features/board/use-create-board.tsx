import { useState } from 'react';
import { usePlatform } from '../../bridge/provider';
import { showToast } from '../../components';
import { ApiError, errorMessage } from '../../shared/api/http';
import { BoardNameSheet } from './board-name-sheet';
import { useCreateBoard } from './queries';

/** 새 보드 만들기 시트. 만들면 그 보드 상세로 가서 "만들었어요" 토스트를 띄운다. */
export function useCreateBoardSheet(takenNames: readonly string[]) {
  const { platform } = usePlatform();
  const [open, setOpen] = useState(false);
  const createBoard = useCreateBoard();

  async function create(name: string) {
    let boardId: number;
    try {
      ({ boardId } = await createBoard.mutateAsync(name));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return 'duplicate';
      showToast(errorMessage(error, '보드를 만들지 못했어요. 다시 시도해 주세요.'));
      return 'failed';
    }
    setOpen(false);
    // 앱은 새 화면(WebView)을 띄우므로 토스트를 여기서 띄우면 보이지 않는다. 상세 화면이 띄우게 넘긴다.
    void platform.navigation.push(`/boards/${boardId}?created=1`).catch(() => {
      showToast(`${name} 보드를 만들었어요`);
    });
    return 'done';
  }

  const sheet = (
    <BoardNameSheet
      open={open}
      title="새 보드 만들기"
      submitLabel="보드 만들기"
      takenNames={takenNames}
      onClose={() => setOpen(false)}
      onSubmit={create}
    />
  );
  return { openSheet: () => setOpen(true), sheet };
}
