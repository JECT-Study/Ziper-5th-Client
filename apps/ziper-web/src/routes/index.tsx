import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { usePlatform } from '../bridge/provider';
import { BottomNavigation } from '../components';
import * as styles from '../styles/home.css';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { platform, status } = usePlatform();
  const [registration, setRegistration] = useState<'idle' | 'opening' | 'error'>('idle');

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
