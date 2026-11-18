import { expoShareWakeURL } from '../share/inbox';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // The URL is just Expo's wake-up signal. Warm shares keep the current native screen.
  if (path === expoShareWakeURL) return initial ? '/' : null;
  return path;
}
