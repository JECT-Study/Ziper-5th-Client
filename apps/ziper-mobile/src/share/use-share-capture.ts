import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { expoShareWakeURL, type ShareInbox } from './inbox';

export function useShareCapture(inbox: ShareInbox) {
  useEffect(() => {
    const capture = () => {
      try {
        // The Expo hook resolves URLs over the network; this feature only needs raw payloads.
        const payloads = getSharedPayloads();
        if (!payloads.length) return;
        inbox.add(payloads);
        clearSharedPayloads();
      } catch {
        // Never log shared URLs. Another foreground or share event can retry the read.
      }
    };
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') capture();
    });
    const link = Linking.addEventListener('url', ({ url }) => {
      if (url === expoShareWakeURL) capture();
    });
    capture();
    return () => {
      app.remove();
      link.remove();
    };
  }, [inbox]);
}
