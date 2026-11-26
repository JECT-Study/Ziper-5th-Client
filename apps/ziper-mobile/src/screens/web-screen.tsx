import Constants from 'expo-constants';
import {
  Stack,
  useFocusEffect,
  useNavigation,
  usePreventRemove,
  useRouter,
  type Href,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Button, Linking, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BridgeDelegate, BridgeWebView } from '@webview-bridge/react-native';
import type { NativeBridge } from '@ziper/bridge/native';
import { failure, incomingShareEvent } from '@ziper/bridge/contract';
import { ActiveScope } from '../bridge/active-scope';
import { backTarget, interceptNativeBack } from '../bridge/back';
import { createHandlers } from '../bridge/handlers';
import { createDelegate } from '../bridge/delegate';
import { documentIdentity } from '../bridge/documents';
import { allowedDocument, externalPage, serviceURL } from '../bridge/security';
import { useMobileServices } from '../bridge/services';
import { SheetSessions, type SheetSnapshot } from '../bridge/sheets';
import { WebView } from '../bridge/webview';
import { NativeActionSheet } from './native-action-sheet';
import { WebLoadError } from './web-load-error';
import { useProductExtraction } from '../product-extraction/use-product-extraction';

type WebScope = ReturnType<typeof createHandlers> & {
  uri: string;
  sheets: SheetSessions;
  back: () => boolean;
};

export type WebScreenTraits = {
  /** 웹이 뒤로 가기 버튼이 있는 헤더를 그린다. 첫 화면이어도 뒤로 가기를 웹 대신 처리한다. */
  webHeader?: boolean;
  /** 상태 표시줄까지 웹이 그린다. 앱 추출을 쓰는 상품 저장 화면이다. */
  edgeToEdge?: boolean;
  /** 외부 공유로 연 화면. 처음 받은 공유를 붙잡고 닫을 때 정리한다. */
  share?: boolean;
};

export function WebScreen({
  path,
  webHeader = false,
  edgeToEdge = false,
  share = false,
}: { path: string } & WebScreenTraits) {
  const { config, auth, shareInbox } = useMobileServices();
  const { extraction, extractionView } = useProductExtraction();
  // 헤더가 없으니 상태 표시줄 아래부터 웹을 그린다. 아래쪽 여백은 웹이 safe-area 로 처리한다.
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const web = useRef<BridgeWebView>(null);
  const depthRef = useRef(0);
  const activationRef = useRef(0);
  const replaceDocument = useRef<() => void>(() => {});
  const currentDocument = useRef<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [shareClosing, setShareClosing] = useState(false);
  const [sheet, setSheet] = useState<
    (SheetSnapshot & { owner: SheetSessions; key: string }) | null
  >(null);
  const [blockedURI, setBlockedURI] = useState<string | null>(null);
  const [scopes] = useState(() => new ActiveScope<WebScope>());
  const uri = serviceURL(config, path);
  const openedShare = useRef(share ? shareInbox.read() : null);
  const blocked = uri !== null && blockedURI === uri;
  const live = useRef({
    config,
    auth,
    router,
    navigation,
    uri,
    blocked,
    disablePrevention: () => {},
  });
  live.current = {
    config,
    auth,
    router,
    navigation,
    uri,
    blocked,
    disablePrevention: live.current.disablePrevention,
  };
  const back = useCallback(
    () => (scopes.current?.uri === live.current.uri ? scopes.current.back() : false),
    [scopes],
  );
  const intercept = interceptNativeBack(sheet !== null, depth);
  const disablePrevention = usePreventRemove(
    intercept || (share && !blocked && uri !== null && !shareClosing),
    () => {
      back();
    },
    { preventInPreloadedRoutes: false },
  );
  live.current.disablePrevention = disablePrevention;

  useEffect(() => {
    depthRef.current = 0;
    currentDocument.current = null;
    setDepth(0);
    setBlockedURI(null);
  }, [uri]);
  useEffect(() => {
    setSheet(null);
    if (!uri || blocked) return;
    const activate = () => {
      setSheet(null);
      depthRef.current = 0;
      setDepth(0);
      scopes.activate(() => {
        const activation = ++activationRef.current;
        const sheets = new SheetSessions((snapshot) =>
          setSheet(
            snapshot
              ? { ...snapshot, owner: sheets, key: `${activation}:${snapshot.token}` }
              : null,
          ),
        );
        const active = () =>
          live.current.uri === uri && !live.current.blocked && live.current.navigation.isFocused();
        const scopeBack = () => {
          if (!active()) return false;
          const { router, disablePrevention } = live.current;
          const canGoBack = router.canGoBack();
          switch (backTarget(sheets.active, depthRef.current, canGoBack)) {
            case 'sheet':
              return sheets.cancel();
            case 'web':
              web.current?.injectJavaScript('window.history.back(); true;');
              return true;
            case 'native':
            case 'root':
              if (!webHeader && !canGoBack) return false;
              if (share) {
                if (openedShare.current) shareInbox.dismiss(openedShare.current.id);
                setShareClosing(true);
                disablePrevention();
              }
              if (canGoBack) router.back();
              else router.replace('/');
              return true;
          }
        };
        const handlers = createHandlers({
          get config() {
            return live.current.config;
          },
          get auth() {
            return live.current.auth;
          },
          platform: Platform.OS === 'android' ? 'android' : 'ios',
          appVersion: Constants.expoConfig?.version ?? '1.0.0',
          active,
          back: scopeBack,
          openExternal: async (url) => {
            await Linking.openURL(url);
          },
          sheets,
          extraction: edgeToEdge ? extraction : undefined,
          shareInbox: share
            ? {
                // This screen keeps its original share even after acknowledgement or reload.
                read: () => (openedShare.current ??= shareInbox.read()),
                dismiss: (id) => {
                  if (id === openedShare.current?.id) shareInbox.dismiss(id);
                },
              }
            : shareInbox,
          navigate: (kind, nextPath) => {
            if (kind === 'replace') {
              // SDK 58 requires BOTH the prop and imperative prevention state cleared.
              sheets.cancel();
              depthRef.current = 0;
              setDepth(0);
              if (share) setShareClosing(true);
              live.current.disablePrevention();
            }
            live.current.router[kind](nextPath as Href);
          },
          setDepth: (value) => {
            if (live.current.uri !== uri || live.current.blocked) return;
            depthRef.current = value;
            setDepth(value);
          },
        });
        return { ...handlers, uri, sheets, back: scopeBack };
      });
    };
    replaceDocument.current = activate;
    activate();
    return () => {
      if (replaceDocument.current === activate) {
        replaceDocument.current = () => {};
        scopes.deactivate();
      }
    };
  }, [uri, blocked, scopes, shareInbox, share, webHeader, edgeToEdge, extraction]);

  const delegate = useMemo<BridgeDelegate<NativeBridge>>(() => {
    // Retained delegates resolve the active scope per call, never capture disposed handlers.
    const invoke: WebScope['invoke'] = (method, ...args) => {
      const scope = scopes.current;
      return scope?.uri === uri
        ? scope.invoke(method, ...args)
        : Promise.resolve(failure('PERMISSION_DENIED'));
    };
    return createDelegate(invoke);
  }, [uri, scopes]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', back);
      const wakeWeb = () => {
        if (live.current.uri !== uri || live.current.blocked || !navigation.isFocused()) return;
        // Only the active document can read the payload through the guarded bridge.
        web.current?.injectJavaScript?.(
          'window.dispatchEvent(new Event("' + incomingShareEvent + '")); true;',
        );
      };
      const unsubscribe = shareInbox.subscribe(wakeWeb);
      if (shareInbox.read()) wakeWeb();
      return () => {
        unsubscribe();
        subscription.remove();
        scopes.current?.suspend();
      };
    }, [back, navigation, scopes, shareInbox, uri]),
  );
  const blockDocument = () => {
    if (live.current.uri !== uri) return;
    live.current.blocked = true;
    scopes.current?.suspend();
    depthRef.current = 0;
    setDepth(0);
    web.current?.stopLoading();
    setBlockedURI(uri);
  };

  return (
    // 웹이 화면 전체(헤더 포함)를 그리므로 네이티브 헤더는 숨긴다. 공유·상품 등록 화면은 기존처럼 여백 없이 두고,
    // 나머지는 상태 표시줄 아래부터 그린다. Android WebView 는 위치와 상관없이 창의 inset 을
    // env(safe-area-inset-top) 으로 알려 주고 웹 body 가 그만큼 띄우므로, 네이티브 여백은 iOS 에만 준다.
    <View
      style={{
        flex: 1,
        paddingTop: edgeToEdge || Platform.OS === 'android' ? 0 : top,
        backgroundColor: '#ffffff',
      }}
    >
      <Stack.Screen
        options={{
          title: 'Ziper',
          headerShown: blocked || uri === null,
          gestureEnabled: !intercept && !share,
          headerBackButtonMenuEnabled: false,
          headerBackVisible: !intercept,
          headerLeft: intercept ? () => <Button title="Back" onPress={back} /> : undefined,
        }}
      />
      {!uri ? (
        <Text accessibilityRole="alert">잘못된 화면 주소예요.</Text>
      ) : blocked ? (
        <View style={{ padding: 24 }}>
          <Text accessibilityRole="alert">허용되지 않은 페이지라서 열지 않았어요.</Text>
        </View>
      ) : (
        <WebView
          key={uri}
          ref={web}
          source={{ uri }}
          delegate={delegate}
          style={{ flex: 1 }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(request) => allowedDocument(config, request.url)}
          renderError={() => <WebLoadError onRetry={() => web.current?.reload()} />}
          onOpenWindow={(event) => {
            // 새 창은 막는다. 랜딩 약관 페이지만 기기 브라우저로 연다.
            const page = externalPage(event.nativeEvent.targetUrl);
            if (page) Linking.openURL(page).catch(() => {});
          }}
          onMessage={(event) => {
            const identity = documentIdentity(event.nativeEvent.data);
            if (identity && identity !== currentDocument.current) {
              currentDocument.current = identity;
              replaceDocument.current();
            }
          }}
          onNavigationStateChange={(state) => {
            if (!allowedDocument(config, state.url)) blockDocument();
          }}
          onLoadStart={(event) => {
            if (!allowedDocument(config, event.nativeEvent.url)) blockDocument();
          }}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows
          allowsBackForwardNavigationGestures={false}
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly
          injectedJavaScriptForMainFrameOnly
          webviewDebuggingEnabled={false}
        />
      )}
      {extractionView}
      {sheet && (
        <NativeActionSheet
          key={sheet.key}
          input={sheet.input}
          onSelect={(id) => sheet.owner.settle(sheet.token, id)}
          onCancel={() => sheet.owner.settle(sheet.token)}
        />
      )}
    </View>
  );
}
