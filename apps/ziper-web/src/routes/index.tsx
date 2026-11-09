import { createFileRoute } from '@tanstack/react-router';
import * as styles from '../styles/landing.css';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Ziper</h1>
      <p className={styles.description}>웹 스타터가 준비되었습니다.</p>
      <a
        className={styles.link}
        href="https://tanstack.com/start/latest/docs/framework/react/overview"
      >
        TanStack Start 문서
      </a>
    </main>
  );
}
