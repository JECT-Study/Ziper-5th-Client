import { isShareURL, type IncomingShare } from '@ziper/bridge/contract';
import type { SharePayload } from 'expo-sharing';

export const expoShareWakeURL = 'ziper://expo-sharing';

function sharedURL(payloads: readonly SharePayload[]): string | null {
  for (const { shareType, value } of payloads) {
    if (shareType !== 'url') continue;
    const url = value.trim();
    if (isShareURL(url)) return url;
  }
  for (const { shareType, value } of payloads) {
    if (shareType !== 'text' || value.length > 16384) continue;
    const plainURL = value.trim();
    if (isShareURL(plainURL)) return plainURL;
    for (const [match] of value.matchAll(/https?:\/\/[^\s<>"'`]+/giu)) {
      const url = match.replace(/[)\]}>.,!?。！？，]+$/u, '');
      if (isShareURL(url)) return url;
    }
  }
  return null;
}

export function createShareInbox() {
  const pending: IncomingShare[] = [];
  const listeners = new Set<() => void>();
  let sequence = 0;
  const notify = () => listeners.forEach((listener) => listener());

  return {
    add(payloads: readonly SharePayload[]) {
      if (!payloads.length || pending.length >= 8) return;
      const url = sharedURL(payloads);
      if (pending.some((share) => share.url === url)) return;
      pending.push({ id: 'share-' + ++sequence, url });
      if (pending.length === 1) notify();
    },
    read: () => pending[0] ?? null,
    dismiss(id: string) {
      if (pending[0]?.id !== id) return;
      pending.shift();
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ShareInbox = ReturnType<typeof createShareInbox>;
