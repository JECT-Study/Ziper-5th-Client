import { getGetBoardsQueryKey, useCreateBoard } from '@ziper/api';
import { ApiError, errorMessage } from '@ziper/api/http';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePlatform } from '../../bridge/provider';
import { showToast } from '../../components';
import { BoardNameSheet } from './board-name-sheet';

export function useCreateBoardSheet(takenNames: readonly string[]) {
  const { platform } = usePlatform();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutateAsync } = useCreateBoard({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBoardsQueryKey() }),
    },
  });

  async function create(name: string) {
    let boardId: number;
    try {
      ({ boardId } = (await mutateAsync({ data: { name } })).data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return 'duplicate';
      showToast(errorMessage(error, '보드를 만들지 못했어요. 다시 시도해 주세요.'));
      return 'failed';
    }
    setOpen(false);
    // 앱은 새 WebView 를 띄우므로 토스트는 상세 화면이 띄운다.
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
