import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { nativeAuth } from '../features/auth';
import { MobileServicesProvider } from '../bridge/services';

export default function RootLayout() {
  return (
    <MobileServicesProvider auth={nativeAuth}>
      <StatusBar style="auto" />
      {/* 화면 위아래 틀은 웹이 그린다. 네이티브 헤더를 숨기고, 뒤로 가기는 웹 화면의 버튼과 스와이프로 한다. */}
      <Stack screenOptions={{ headerShown: false, headerBackButtonMenuEnabled: false }}>
        <Stack.Screen name="index" options={{ title: 'Ziper' }} />
      </Stack>
    </MobileServicesProvider>
  );
}
