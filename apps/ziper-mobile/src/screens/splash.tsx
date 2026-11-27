import { palette } from '@ziper/design-tokens';
import * as SplashScreen from 'expo-splash-screen';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

// 네이티브 스플래시는 그라데이션을 못 그려서 lime300 단색 + 로고로 띄운다(app.json).
// 바로 그 위에 Figma 스플래시(그라데이션)를 같은 자리에 덮고, 첫 웹 화면이 다 뜨면 걷어 낸다.
SplashScreen.preventAutoHideAsync().catch(() => {});

// 웹이 끝내 응답하지 않아도 스플래시에 갇히지 않게 한다. 그 뒤로는 WebView 의 오류 화면이 보인다.
const FALLBACK_MS = 10_000;

const SplashDone = createContext<() => void>(() => {});

/** 첫 웹 화면이 다 떴을 때 부른다. 두 번째부터는 아무 일도 하지 않는다. */
export const useSplashDone = () => useContext(SplashDone);

export function SplashGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const done = useCallback(() => setReady(true), []);

  useEffect(() => {
    const timer = setTimeout(done, FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
      setGone(true),
    );
  }, [ready, opacity]);

  return (
    <SplashDone value={done}>
      {children}
      {!gone && (
        <Animated.View
          style={[styles.root, { opacity }]}
          onLayout={() => void SplashScreen.hideAsync().catch(() => {})}
        >
          <Image source={require('../../assets/splash-logo.png')} style={styles.logo} />
        </Animated.View>
      )}
    </SplashDone>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: `linear-gradient(to bottom, ${palette.lime300}, ${palette.lime100})`,
  },
  logo: { width: 200, height: 64 },
});
