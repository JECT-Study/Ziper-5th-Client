import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import * as styles from './Dialog.css';

export function Dialog({
  children,
  className,
  titleId,
  descriptionId,
  onClose,
  onOpenError,
  dismissOnBackdrop,
  alert,
}: {
  children: ReactNode;
  className: string;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  onOpenError?: (() => void) | undefined;
  dismissOnBackdrop?: boolean;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cleaningUp = useRef(false);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = dialog.ownerDocument.activeElement;
    try {
      dialog.showModal();
    } catch (error) {
      if (!onOpenError) throw error;
      onOpenError();
      return;
    }
    return () => {
      cleaningUp.current = true;
      dialog.close();
      cleaningUp.current = false;
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        previousFocus !== dialog.ownerDocument.activeElement
      ) {
        previousFocus.focus();
      }
    };
  }, [onOpenError]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, className)}
      role={alert ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={(event) => {
        // A delayed close event from StrictMode cleanup must not dismiss the reopened dialog.
        if (!cleaningUp.current && !event.currentTarget.open) onClose();
      }}
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
