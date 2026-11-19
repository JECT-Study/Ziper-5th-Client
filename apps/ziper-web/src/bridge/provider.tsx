import { useRouter } from '@tanstack/react-router';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  BridgeError,
  type Runtime,
  type RuntimeStatus,
  type WebAuthService,
} from '@ziper/bridge/contract';
import {
  createPlatform,
  createRuntime,
  type Platform,
  type RuntimeOptions,
} from '@ziper/bridge/runtime';
import { createWebNavigation } from '../platform/navigation';
import { createWebSheets, type WebSheet } from '../platform/action-sheet';
import { WebActionSheet } from '../platform/web-action-sheet';

export interface BridgeProviderConfig {
  auth?: WebAuthService;
  runtime?: RuntimeOptions;
  onError?: (error: unknown) => void;
}

type PublicPlatform = Pick<Platform, 'auth' | 'navigation' | 'sheets' | 'incomingShare'>;

const Context = createContext<{ platform: PublicPlatform; status: RuntimeStatus } | null>(null);

const serverSnapshot = (): RuntimeStatus => 'initializing';

const emptySubscribe = () => () => {};

const reportError = (error: unknown) => console.error('Platform synchronization failed', error);

export function BridgeProvider({
  children,
  config,
}: {
  children: ReactNode;
  config?: BridgeProviderConfig;
}) {
  const router = useRouter();
  const current = useRef<Platform | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [sheet, setSheet] = useState<WebSheet | null>(null);
  // Forward at invocation time: retained callbacks never capture a disposed StrictMode/BFCache runtime.
  const platform = useMemo<PublicPlatform>(() => {
    const get = () => {
      if (!current.current) throw new BridgeError('BRIDGE_NOT_READY');
      return current.current;
    };
    return {
      auth: {
        login: async (provider) => get().auth.login(provider),
        restore: async () => get().auth.restore(),
        logout: async () => get().auth.logout(),
      },
      navigation: {
        push: async (path) => get().navigation.push(path),
        replace: async (path) => get().navigation.replace(path),
        back: async () => get().navigation.back(),
      },
      sheets: { actions: async (input) => get().sheets.actions(input) },
      incomingShare: {
        read: async () => get().incomingShare.read(),
        dismiss: async (id) => get().incomingShare.dismiss(id),
      },
    };
  }, []);
  const status = useSyncExternalStore(
    runtime?.subscribe ?? emptySubscribe,
    () => runtime?.status ?? 'initializing',
    serverSnapshot,
  );

  useEffect(() => {
    let stop: (() => void) | undefined;
    const start = () => {
      if (stop) return;
      const next = createRuntime(config?.runtime);
      const sheets = createWebSheets(setSheet);
      const instance = createPlatform(next, {
        auth: config?.auth,
        navigation: createWebNavigation(router),
        sheets,
      });
      current.current = instance;
      setRuntime(next);
      const onError = config?.onError ?? reportError;
      const sync = () => {
        void instance.syncHistory().catch(onError);
      };
      const unbindHistory = router.history.subscribe(sync);
      const unbindRuntime = next.subscribe(() => {
        if (next.status === 'native') sync();
      });
      stop = () => {
        unbindHistory();
        unbindRuntime();
        if (current.current === instance) current.current = null;
        instance.dispose();
        sheets.dispose();
        next.dispose();
        stop = undefined;
      };
      void next.initialize().catch(onError);
    };
    const pagehide = () => stop?.();
    const pageshow = () => start();
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    start();
    return () => {
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      stop?.();
    };
  }, [router, config]);

  const value = useMemo(() => ({ platform, status }), [platform, status]);
  return (
    <Context.Provider value={value}>
      {children}
      {sheet && <WebActionSheet key={sheet.input.operationId} sheet={sheet} />}
    </Context.Provider>
  );
}

export function usePlatform() {
  const context = useContext(Context);
  if (!context) throw new Error('usePlatform requires BridgeProvider');
  return context;
}
