import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import * as styles from './Dialog.css';

export function Dialog({
  children,
  className,
  titleId,
  descriptionId,
  onClose,
  dismissOnBackdrop,
  alert,
}: {
  children: ReactNode;
  className: string;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, className)}
      role={alert ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={
        dismissOnBackdrop
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < left ||
                event.clientX > right ||
                event.clientY < top ||
                event.clientY > bottom
              )
                onClose();
            }
          : undefined
      }
    >
      {children}
    </dialog>
  );
}
