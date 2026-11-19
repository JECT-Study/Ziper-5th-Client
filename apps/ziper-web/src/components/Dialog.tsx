import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { cx } from './cx';
import * as styles from './Dialog.css';

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
  );
}

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
  const pressedBackdrop = useRef(false);

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
      data-dismiss-on-backdrop={dismissOnBackdrop || undefined}
      onClose={(event) => {
        // A delayed close event from StrictMode cleanup must not dismiss the reopened dialog.
        if (!cleaningUp.current && !event.currentTarget.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={
        dismissOnBackdrop
          ? (event) => {
              if (event.isPrimary)
                pressedBackdrop.current = event.button === 0 && isBackdrop(event);
            }
          : undefined
      }
      onPointerCancel={() => {
        pressedBackdrop.current = false;
      }}
      onClick={
        dismissOnBackdrop
          ? (event) => {
              const shouldClose = pressedBackdrop.current && event.detail > 0 && isBackdrop(event);
              pressedBackdrop.current = false;
              if (shouldClose) onClose();
            }
          : undefined
      }
    >
      {children}
    </dialog>
  );
}
