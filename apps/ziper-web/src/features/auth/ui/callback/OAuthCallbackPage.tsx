import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '../../../../components';
import { LoadingOverlay } from '../common/LoadingOverlay';
import * as styles from './callback.css';
import { useOAuthCodeExchange } from './useOAuthCodeExchange';

/** 웹 소셜 로그인에서 돌아오는 화면. 처리하는 동안 로딩, 실패하면 안내와 돌아가기 버튼을 보여준다. */
export function OAuthCallbackPage({ provider }: { provider: string }) {
  const navigate = useNavigate();
  const result = useOAuthCodeExchange(provider);

  useEffect(() => {
    if (result.status === 'cancelled') navigate({ to: '/login', replace: true });
    // 처음 온 사람은 약관 동의 → 가입 완료 화면으로 간다.
    if (result.status === 'signupRequired') navigate({ to: '/signup/terms', replace: true });
    if (result.status === 'signedIn') navigate({ to: '/', replace: true });
  }, [result, navigate]);

  if (result.status !== 'failed') return <LoadingOverlay />;

  return (
    <main className={styles.failed}>
      <p>{result.message}</p>
      <Button onClick={() => navigate({ to: '/login', replace: true })}>로그인 화면으로</Button>
    </main>
  );
}
