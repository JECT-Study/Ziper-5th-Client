import {
  BridgeError,
  sheetInputSchema,
  type SheetInput,
  type SheetResult,
} from '@ziper/bridge/contract';

export function createWebSheets(document: Document) {
  let active: (() => void) | undefined;
  let closed = false;
  return {
    actions(input: SheetInput, signal?: AbortSignal): Promise<SheetResult> {
      if (closed || signal?.aborted) return Promise.reject(new BridgeError('BRIDGE_CLOSED'));
      if (active || !sheetInputSchema.safeParse(input).success)
        return Promise.reject(new BridgeError('INVALID_REQUEST'));
      return new Promise((resolve, reject) => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const dialog = document.createElement('dialog');
        const title = document.createElement('h2');
        title.id = `sheet-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
        title.textContent = input.title || '작업 선택';
        Object.assign(dialog.style, {
          position: 'fixed',
          inset: 'auto 0 0',
          margin: '0 auto',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '80dvh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '20px',
          border: '0',
          borderRadius: '16px 16px 0 0',
        });
        dialog.setAttribute('aria-labelledby', title.id);
        dialog.setAttribute('aria-modal', 'true');
        dialog.append(title);
        let settled = false;
        const finish = (result: SheetResult | BridgeError) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener('abort', abort);
          dialog.removeEventListener('cancel', cancel);
          dialog.removeEventListener('close', cancel);
          dialog.removeEventListener('keydown', keydown);
          dialog.remove();
          active = undefined;
          if (previousFocus?.isConnected) previousFocus.focus();
          if (result instanceof BridgeError) reject(result);
          else resolve(result);
        };
        const abort = () => finish(new BridgeError('BRIDGE_CLOSED'));
        const cancel = (event: Event) => {
          event.preventDefault();
          finish({ status: 'cancelled' });
        };
        const keydown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') cancel(event);
        };
        active = abort;
        signal?.addEventListener('abort', abort, { once: true });
        dialog.addEventListener('cancel', cancel);
        dialog.addEventListener('close', cancel);
        dialog.addEventListener('keydown', keydown);
        for (const action of input.actions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = action.label;
          Object.assign(button.style, {
            display: 'block',
            width: '100%',
            padding: '12px',
            marginBlock: '8px',
          });
          if (action.destructive) button.dataset.destructive = 'true';
          button.addEventListener(
            'click',
            () => finish({ status: 'selected', actionId: action.id }),
            { once: true },
          );
          dialog.append(button);
        }
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = '취소';
        cancelButton.addEventListener('click', cancel, { once: true });
        dialog.append(cancelButton);
        document.body.append(dialog);
        try {
          dialog.showModal();
          dialog.querySelector('button')?.focus();
        } catch {
          finish(new BridgeError('INTERNAL'));
        }
      });
    },
    dispose() {
      if (closed) return;
      closed = true;
      active?.();
    },
  };
}
