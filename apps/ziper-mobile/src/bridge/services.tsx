import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import type { NativeAuthService } from '@ziper/bridge/contract';
import { hostConfig, type HostConfig } from './security';

export function configuredHost(): HostConfig {
  return hostConfig(
    process.env.EXPO_PUBLIC_WEB_URL,
    __DEV__,
    Platform.OS === 'android' ? 'android' : 'ios',
  );
}

type Services = Readonly<{ config: HostConfig; auth?: NativeAuthService }>;

const ServicesContext = createContext<Services | null>(null);

// Inject SDK-backed auth here; never put credentials/session state in the transport store.
export function MobileServicesProvider({
  children,
  auth,
}: {
  children: ReactNode;
  auth?: NativeAuthService;
}) {
  const configuration = useMemo(() => {
    try {
      return { config: configuredHost() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid web host configuration' };
    }
  }, []);
  if (!configuration.config)
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text accessibilityRole="alert">{configuration.error}</Text>
      </View>
    );
  return (
    <ServicesContext.Provider value={{ config: configuration.config, auth }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useMobileServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('Missing MobileServicesProvider');
  return services;
}
