import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MobileServicesProvider } from '../bridge/services';

export default function RootLayout() {
  return (
    <MobileServicesProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackButtonMenuEnabled: false }}>
        <Stack.Screen name="index" options={{ title: 'Ziper' }} />
        <Stack.Screen name="web" options={{ title: 'Ziper' }} />
      </Stack>
    </MobileServicesProvider>
  );
}
