import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireSignedOut } from '../../features/auth';
import { useEffect, useState } from 'react';
import tooltipTriangle from '../../assets/login/tooltip-triangle.svg';
import welcomeImage from '../../assets/login/welcome.png';
import {
  Button,
  Divider,
  SocialLoginButton,
  showToast,
  type SocialProvider,
} from '../../components';
import * as styles from '../../styles/login.css';

export const Route = createFileRoute('/login/')({
  ssr: false,
  beforeLoad: requireSignedOut,
  component: LoginPage,
});

const PROVIDERS: SocialProvider[] = ['naver', 'kakao', 'apple'];

const LAST_PROVIDER_KEY = 'ziper:lastLoginProvider';

function LoginPage() {
  const navigate = useNavigate();
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);

  // TODO(소셜 로그인 연결): 로그인에 성공하면 이 값에 provider 를 저장한다.
  useEffect(() => {
    setLastProvider(localStorage.getItem(LAST_PROVIDER_KEY) as SocialProvider | null);
  }, []);

  // TODO(소셜 로그인 연결): 팀 공용 브릿지(JEC-19)가 들어오면 앱의 네이티브 SDK 로그인을 부른다.
  function login(provider: SocialProvider) {
    void provider;
    showToast('소셜 로그인은 준비 중이에요');
  }

  return (
    <main className={styles.page}>
      <div className={styles.illustration} aria-hidden>
        <img className={styles.illustrationImage} src={welcomeImage} alt="" />
        <div className={styles.illustrationFade} />
      </div>

      <section className={styles.welcome}>
        <h1 className={styles.heading}>
          저장해둔 위시,
          <br />
          다시 꺼내보세요
        </h1>
        <p className={styles.description}>
          여러 쇼핑몰의 관심 상품을 보드에 모아두고,
          <br />
          잊혀가는 위시를 가볍게 정리해요
        </p>
      </section>

      <div className={styles.actions}>
        <div className={styles.socialButtons}>
          {PROVIDERS.map((p) => (
            <div key={p} className={styles.buttonSlot}>
              {lastProvider === p && <RecentLoginTooltip />}
              <SocialLoginButton provider={p} onClick={() => login(p)} />
            </div>
          ))}
        </div>

        <Divider />

        <Button variant="secondary" onClick={() => navigate({ to: '/signup' })}>
          이메일로 가입하기
        </Button>
        <p className={styles.signInRow}>
          <span className={styles.signInHint}>이미 회원이신가요?</span>
          <button
            type="button"
            className={styles.signInLink}
            // TODO(JEC-66): 이메일 로그인 API 가 나오면 이메일 로그인 화면으로 보낸다.
            onClick={() => showToast('이메일 로그인은 준비 중이에요')}
          >
            로그인 하기
          </button>
        </p>
      </div>
    </main>
  );
}

function RecentLoginTooltip() {
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipBubble}>최근 로그인</span>
      <img className={styles.tooltipTail} src={tooltipTriangle} alt="" />
    </div>
  );
}
