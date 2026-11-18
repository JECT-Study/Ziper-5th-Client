import { useId, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { ButtonGroup } from './Footer';
import * as styles from './Modal.css';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  /** 버튼들. 보통 <Button> 1~2개. */
  actions: ReactNode;
  actionsLayout?: 'single' | 'split' | 'stack';
};

/** 확인이 필요한 안내 팝업. 확인 버튼은 호출자가 지정하고 Escape는 onClose를 호출한다. */
export function Modal({
  open,
  title,
  description,
  onClose,
  actions,
  actionsLayout = 'split',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  if (!open) return null;
  return (
    <Dialog
      className={styles.card}
      titleId={titleId}
      descriptionId={descriptionId}
      onClose={onClose}
      alert
    >
      <div className={styles.contents}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
      </div>
      <ButtonGroup layout={actionsLayout}>{actions}</ButtonGroup>
    </Dialog>
  );
}
