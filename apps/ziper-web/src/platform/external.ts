import { BridgeError } from '@ziper/bridge/contract';
import { isShareURL } from '@ziper/product-extraction/link';

export async function openWebExternal(url: string): Promise<void> {
  if (!isShareURL(url)) throw new BridgeError('INVALID_REQUEST');
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new BridgeError('PERMISSION_DENIED');
  try {
    tab.opener = null;
    tab.location.replace(url);
  } catch (error) {
    tab.close();
    throw error;
  }
}
