import { BottomSheet } from '@expo/ui';
import Constants from 'expo-constants';
import { Stack, useFocusEffect, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Button, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { BridgeDelegate, BridgeWebView } from '@webview-bridge/react-native';
import type { NativeBridge } from '@ziper/bridge/native';
import { failure, incomingShareEvent } from '@ziper/bridge/contract';
import { ActiveScope } from '../bridge/active-scope';
import { backTarget, interceptNativeBack } from '../bridge/back';
import { createHandlers } from '../bridge/handlers';
import { createDelegate } from '../bridge/delegate';
import { documentIdentity } from '../bridge/documents';
import { allowedDocument, serviceURL } from '../bridge/security';
import { useMobileServices } from '../bridge/services';
import { SheetSessions, type SheetSnapshot } from '../bridge/sheets';
import { WebView } from '../bridge/webview';

type WebScope = ReturnType<typeof createHandlers> & {
  uri: string;
  sheets: SheetSessions;
  back: () => boolean;
};

export function WebScreen({ path }: { path: string }) {
  const { config, auth, shareInbox } = useMobileServices();
  const router = useRouter();
  const navigation = useNavigation();
  const web = useRef<BridgeWebView>(null);
  const depthRef = useRef(0);
  const activationRef = useRef(0);
  const replaceDocument = useRef<() => void>(() => {});
  const currentDocument = useRef<string | null>(null);
  const [depth, setDepth] = useState(0);
  const [sheet, setSheet] = useState<
    (SheetSnapshot & { owner: SheetSessions; key: string }) | null
  >(null);
  const [blockedURI, setBlockedURI] = useState<string | null>(null);
  const [scopes] = useState(() => new ActiveScope<WebScope>());
  const uri = serviceURL(config, path);
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
    intercept,
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
          switch (backTarget(sheets.active, depthRef.current, live.current.router.canGoBack())) {
            case 'sheet':
              return sheets.cancel();
            case 'web':
              web.current?.injectJavaScript('window.history.back(); true;');
              return true;
            case 'native':
              live.current.router.back();
              return true;
            case 'root':
              return false;
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
          sheets,
          shareInbox,
          navigate: (kind, nextPath) => {
            if (kind === 'replace') {
              // SDK 58 requires BOTH the prop and imperative prevention state cleared.
              sheets.cancel();
              depthRef.current = 0;
              setDepth(0);
              live.current.disablePrevention();
            }
            live.current.router[kind]({ pathname: '/web', params: { path: nextPath } });
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
  }, [uri, blocked, scopes, shareInbox]);

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
    scopes.current?.sheets.cancel();
    depthRef.current = 0;
    setDepth(0);
    web.current?.stopLoading();
    setBlockedURI(uri);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Ziper',
          gestureEnabled: !intercept,
          headerBackButtonMenuEnabled: false,
          headerBackVisible: !intercept,
          headerLeft: intercept ? () => <Button title="Back" onPress={back} /> : undefined,
        }}
      />
      {!uri ? (
        <Text accessibilityRole="alert">Invalid service-relative page path.</Text>
      ) : blocked ? (
        <View style={{ padding: 24 }}>
          <Text accessibilityRole="alert">This page was blocked by the web host policy.</Text>
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
          onOpenWindow={() => {
            /* Block popups instead of handing them to Linking. */
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
      {sheet && (
        <BottomSheet
          key={sheet.key}
          isPresented
          onDismiss={() => sheet.owner.settle(sheet.token)}
          shouldDismissOnBackPress
        >
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontSize: 20 }}>
              {sheet.input.title}
            </Text>
            {sheet.input.actions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                onPress={() => sheet.owner.settle(sheet.token, action.id)}
                style={{ padding: 14 }}
              >
                <Text style={{ color: action.destructive ? '#b00020' : '#111' }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Button title="Cancel" onPress={() => sheet.owner.settle(sheet.token)} />
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}
