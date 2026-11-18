import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { BottomNavigation } from '../components';
import { usePlatform } from '../bridge/provider';
import * as styles from '../styles/landing.css';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

const unavailableTabs = ['board', 'rediscover', 'my'] as const;

function LandingPage() {
  const { platform, status } = usePlatform();
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);

  async function openRegistration() {
    setOpenError(false);
    setOpening(true);
    try {
      await platform.navigation.push('/register-product');
    } catch {
      setOpenError(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>Ziper</h1>
        <p className={styles.description}>마음에 든 상품을 추가해 보세요.</p>
        {openError && (
          <p className={styles.error} role="alert">
            상품 추가 화면을 열지 못했어요.
          </p>
        )}
      </div>
      <BottomNavigation
        active="home"
        disabledTabs={unavailableTabs}
        onSelect={() => {}}
        onAdd={() => void openRegistration()}
        addDisabled={opening || status === 'initializing'}
      />
    </main>
  );
}
