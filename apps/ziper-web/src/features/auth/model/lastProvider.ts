import type { Provider } from '@ziper/bridge/contract';

// 로그인 화면의 "최근 로그인" 말풍선용. 민감한 값이 아니라 localStorage 에 둔다.
const KEY = 'ziper:lastLoginProvider';

export const loadLastProvider = () => localStorage.getItem(KEY) as Provider | null;

export const saveLastProvider = (provider: string) => localStorage.setItem(KEY, provider);
