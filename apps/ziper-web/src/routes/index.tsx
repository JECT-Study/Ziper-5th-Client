import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { usePlatform } from '../bridge/provider';
import { BottomNavigation, Button } from '../components';
import { requireSignedIn, useLogout } from '../features/auth';
import * as styles from '../styles/home.css';

export const Route = createFileRoute('/')({
  // 로그인 여부(브라우저 저장 토큰)는 브라우저에서만 확인할 수 있다.
  ssr: false,
  beforeLoad: requireSignedIn,
  component: HomePage,
});

function HomePage() {
  const { platform, status } = usePlatform();
  const [registration, setRegistration] = useState<'idle' | 'opening' | 'error'>('idle');
  const navigate = useNavigate();
  const { logout, pending: loggingOut } = useLogout();

  async function logoutAndLeave() {
    await logout();
    navigate({ to: '/login', replace: true });
  }

  async function openRegistration() {
    setRegistration('opening');
    try {
      await platform.navigation.push('/register-product');
      setRegistration('idle');
    } catch {
      setRegistration('error');
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>Ziper</h1>
        <p className={styles.description}>마음에 든 상품을 추가해 보세요.</p>
        {registration === 'error' && (
          <p className={styles.error} role="alert">
            상품 추가 화면을 열지 못했어요.
          </p>
        )}
        {/* TODO: 로그인 테스트용 임시 버튼. 마이페이지가 생기면 옮긴다. */}
        <Button variant="secondary" size="small" loading={loggingOut} onClick={logoutAndLeave}>
          로그아웃
        </Button>
      </div>
      <BottomNavigation
        active="home"
        onAdd={
          registration === 'opening' || status === 'initializing' ? undefined : openRegistration
        }
      />
    </main>
  );
}
