import { useLocalSearchParams } from 'expo-router';
import { WebScreen, type WebScreenTraits } from './web-screen';

/** 네이티브 경로를 같은 웹 경로로 연다. pattern 은 이 파일의 Expo Router 경로다. */
export function WebRoute({ pattern, ...traits }: { pattern: string } & WebScreenTraits) {
  const params = useLocalSearchParams();
  const segments = new Set<string>();
  const pathname = pattern.replace(/\[(?:\.\.\.)?(\w+)\]/g, (_, name: string) => {
    segments.add(name);
    return [params[name] ?? []].flat().map(encodeURIComponent).join('/');
  });
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (segments.has(key)) continue;
    for (const item of [value ?? []].flat()) query.append(key, item);
  }
  const path = query.size ? `${pathname}?${query}` : pathname;
  return <WebScreen key={path} path={path} {...traits} />;
}
