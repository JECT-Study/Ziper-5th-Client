import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';
import * as styles from './BottomSheet.css';

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 버튼 영역. 보통 <Footer layout="stack">. */
  footer?: ReactNode;
};

/** 아래에서 올라오는 시트. 바깥(어두운 영역)이나 X 를 누르면 onClose 가 불린다. */
export function BottomSheet({ open, title, onClose, children, footer }: BottomSheetProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handlerArea}>
          <span className={styles.handler} />
        </div>
        <div className={styles.titleBar}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            <Icon name="xmark-line" />
          </button>
        </div>
        <div className={styles.contents}>{children}</div>
        {footer}
      </div>
    </div>
  );
}
