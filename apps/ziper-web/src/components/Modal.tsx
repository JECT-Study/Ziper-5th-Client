import { useId, type ReactNode } from 'react';
import { ButtonGroup } from './Footer';
import * as styles from './Modal.css';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  /** 버튼들. 보통 <Button> 1~2개. */
  actions: ReactNode;
  actionsLayout?: 'single' | 'split' | 'stack';
};

/** 확인이 필요한 안내 팝업(modal/default). 닫기는 actions 의 버튼에서 처리한다. */
export function Modal({ open, title, description, actions, actionsLayout = 'split' }: ModalProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className={styles.overlay}>
      <div role="alertdialog" aria-modal aria-labelledby={titleId} className={styles.card}>
        <div className={styles.contents}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        <ButtonGroup layout={actionsLayout}>{actions}</ButtonGroup>
      </div>
    </div>
  );
}
