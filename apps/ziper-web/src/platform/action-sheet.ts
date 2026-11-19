import {
  BridgeError,
  sheetInputSchema,
  type SheetInput,
  type SheetResult,
} from '@ziper/bridge/contract';

export type WebSheet = {
  input: SheetInput;
  settle: (result: SheetResult) => void;
  failToOpen: () => void;
};

export function createWebSheets(present: (sheet: WebSheet | null) => void) {
  let abortPending: (() => void) | undefined;
  let closed = false;
  return {
    actions(input: SheetInput, signal?: AbortSignal): Promise<SheetResult> {
      if (closed || signal?.aborted) return Promise.reject(new BridgeError('BRIDGE_CLOSED'));
      if (!sheetInputSchema.safeParse(input).success)
        return Promise.reject(new BridgeError('INVALID_REQUEST'));
      if (abortPending) return Promise.reject(new BridgeError('PERMISSION_DENIED'));

      return new Promise((resolve, reject) => {
        const finish = (result: SheetResult | BridgeError) => {
          if (abortPending !== abort) return;
          abortPending = undefined;
          signal?.removeEventListener('abort', abort);
          present(null);
          if (result instanceof BridgeError) reject(result);
          else resolve(result);
        };
        const abort = () => finish(new BridgeError('BRIDGE_CLOSED'));
        abortPending = abort;
        signal?.addEventListener('abort', abort, { once: true });
        present({
          input,
          settle: finish,
          failToOpen: () => finish(new BridgeError('INTERNAL')),
        });
      });
    },
    dispose() {
      closed = true;
      abortPending?.();
    },
  };
}
