import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { usePlatform } from '../bridge/provider';
import { BottomNavigation } from '../components';
import { requireSignedIn } from '../features/auth';
import { HomeBoards } from '../features/board';
import { useTabNavigation } from '../shared/use-tab-navigation';
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
  const selectTab = useTabNavigation();

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
        {/* 홈의 배너·최근 저장은 홈 작업에서 채운다. 여기서는 보드 영역만 둔다. */}
        <HomeBoards />
        {registration === 'error' && (
          <p className={styles.error} role="alert">
            상품 추가 화면을 열지 못했어요.
          </p>
        )}
      </div>
      <BottomNavigation
        active="home"
        onSelect={selectTab}
        onAdd={
          registration === 'opening' || status === 'initializing' ? undefined : openRegistration
        }
      />
    </main>
  );
}
