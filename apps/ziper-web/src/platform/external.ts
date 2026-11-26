import { BridgeError } from '@ziper/bridge/contract';
import { isShareURL } from '@ziper/product-extraction/link';

export async function openWebExternal(target: string | (() => Promise<string>)): Promise<void> {
  if (typeof target === 'string' && !isShareURL(target)) throw new BridgeError('INVALID_REQUEST');
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new BridgeError('PERMISSION_DENIED');
  try {
    tab.opener = null;
    // Reserve the tab during the click even when the URL must come from the API.
    const url = typeof target === 'string' ? target : await target();
    if (!isShareURL(url)) throw new BridgeError('INVALID_REQUEST');
    if (tab.closed) return;
    tab.location.replace(url);
  } catch (error) {
    tab.close();
    throw error;
  }
}
