import { useState, type FormEvent } from 'react';
import { BottomSheet, Button, TextField } from '../../components';
import { useBackLayer } from '../../shared/use-back-layer';
import { BOARD_NAME_MAX, checkBoardName } from './board-name';
import * as styles from './board.css';

const DUPLICATE = '이미 사용 중인 보드 이름이에요';

type BoardNameSheetProps = {
  open: boolean;
  /** 예: "새 보드 만들기", "보드명 수정" */
  title: string;
  /** 예: "보드 만들기", "수정완료" */
  submitLabel: string;
  initialName?: string;
  /** 중복을 미리 막을 기존 보드 이름들. 수정할 때는 자기 이름을 빼고 넘긴다. */
  takenNames: readonly string[];
  onClose: () => void;
  /** 이름이 이미 있으면 'duplicate', 그 밖의 실패는 'failed'(안내는 부르는 쪽이 한다). 실패하면 시트는 열린 채로 둔다. */
  onSubmit: (name: string) => Promise<'done' | 'duplicate' | 'failed'>;
  /** 뒤로 가기를 시트가 직접 받는다. 다른 시트에서 이어 열려 바깥이 이미 받고 있으면 끈다. */
  backLayer?: boolean;
};

/** 보드 이름을 입력받는 바텀시트. 새 보드 만들기와 보드명 수정이 같이 쓴다. */
export function BoardNameSheet({ open, backLayer = true, ...props }: BoardNameSheetProps) {
  // 열려 있는 동안 history 한 칸을 쌓아서, Android 뒤로 가기·브라우저 뒤로 가기가 시트부터 닫게 한다.
  // 늘 마운트된 여기서 open 으로 켜고 끈다. 열린 채로 처음 마운트되는 내용 쪽에 두면
  // 개발 모드(StrictMode)가 effect 를 두 번 돌리면서 쌓은 칸을 되돌리다 화면 밖까지 뒤로 간다.
  useBackLayer(open && backLayer, props.onClose);
  // 열 때마다 입력을 새로 시작하도록 닫히면 내용을 버린다.
  return open ? <BoardNameSheetContent {...props} /> : null;
}

function BoardNameSheetContent({
  title,
  submitLabel,
  initialName = '',
  takenNames,
  onClose,
  onSubmit,
}: Omit<BoardNameSheetProps, 'open' | 'backLayer'>) {
  const [value, setValue] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  // 서버가 중복이라고 한 이름. 화면에 받아 둔 목록에 없던 이름(다른 기기에서 만든 보드)도 막는다.
  const [rejected, setRejected] = useState<string[]>([]);

  const check = checkBoardName(value, [...takenNames, ...rejected]);
  const unchanged = initialName !== '' && value.trim() === initialName;
  const canSubmit = check === 'ok' && !unchanged && !submitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const name = value.trim();
    setSubmitting(true);
    try {
      const result = await onSubmit(name);
      if (result === 'duplicate') setRejected((names) => [...names, name]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open
      title={title}
      onClose={onClose}
      footer={
        <div className={styles.sheetFooter}>
          <Button type="submit" form="board-name-form" disabled={!canSubmit} loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form id="board-name-form" onSubmit={submit} className={styles.sheetBody}>
        <TextField
          variant="box"
          aria-label="보드 이름"
          placeholder="보드 이름을 입력해 주세요"
          value={value}
          maxLength={BOARD_NAME_MAX}
          showCounter
          autoFocus
          enterKeyHint="done"
          onChange={(event) => setValue(event.target.value)}
          onClear={() => setValue('')}
          error={check === 'duplicate' ? DUPLICATE : undefined}
          success={check === 'ok' && !unchanged}
          helperText={check === 'ok' && !unchanged ? '사용가능한 이름이에요' : undefined}
        />
      </form>
    </BottomSheet>
  );
}
