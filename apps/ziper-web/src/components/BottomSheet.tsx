import { useId, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { cx } from './cx';
import { Icon } from './Icon';
import * as styles from './BottomSheet.css';

type BottomSheetProps = {
  className?: string;
  open: boolean;
  title: string;
  onClose: () => void;
  onOpenError?: () => void;
  children: ReactNode;
  /** 하단 버튼 영역. 보통 <Footer layout="stack">. */
  footer?: ReactNode;
  /** 제목 옆 X 버튼. 아래에 "닫기" 버튼이 따로 있는 메뉴 시트는 끈다. */
  showClose?: boolean;
};

/** 아래에서 올라오는 시트. 바깥(어두운 영역)이나 X 를 누르면 onClose 가 불린다. */
export function BottomSheet({
  className,
  open,
  title,
  onClose,
  onOpenError,
  children,
  footer,
  showClose = true,
}: BottomSheetProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <Dialog
      className={cx(styles.sheet, className)}
      titleId={titleId}
      onClose={onClose}
      onOpenError={onOpenError}
      dismissOnBackdrop
    >
      <div className={styles.handlerArea}>
        <span className={styles.handler} />
      </div>
      <div className={styles.contents}>
        <div className={styles.titleBar}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {showClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
              <Icon name="xmark-line" />
            </button>
          )}
        </div>
        {children}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </Dialog>
  );
}
