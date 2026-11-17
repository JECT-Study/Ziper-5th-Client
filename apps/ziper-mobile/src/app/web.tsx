import { useLocalSearchParams } from 'expo-router';
import { WebScreen } from '../screens/web-screen';
export default function WebRoute() {
  const { path } = useLocalSearchParams<{ path?: string | string[] }>();
  return (
    <WebScreen
      key={typeof path === 'string' ? path : 'invalid'}
      path={typeof path === 'string' ? path : ''}
    />
  );
}
