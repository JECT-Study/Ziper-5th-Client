import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import type { WebSheet } from './action-sheet';
import * as styles from './web-action-sheet.css';

export function WebActionSheet({ sheet }: { sheet: WebSheet }) {
  const { input, settle, failToOpen } = sheet;
  const cancel = () => settle({ status: 'cancelled' });

  return (
    <BottomSheet
      open
      title={input.title || '작업 선택'}
      onClose={cancel}
      onOpenError={failToOpen}
      footer={
        <Footer layout="stack">
          <Button variant="secondary" onClick={cancel}>
            취소
          </Button>
        </Footer>
      }
    >
      <div className={styles.actions}>
        {input.actions.map((action) => (
          <Button
            key={action.id}
            variant="secondary"
            className={action.destructive ? styles.destructive : styles.action}
            onClick={() => settle({ status: 'selected', actionId: action.id })}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </BottomSheet>
  );
}
