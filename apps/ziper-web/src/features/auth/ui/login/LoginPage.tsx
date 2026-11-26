import { useNavigate } from '@tanstack/react-router';
import { BridgeError, type Provider } from '@ziper/bridge/contract';
import tooltipTriangle from '../../../../assets/login/tooltip-triangle.svg';
import welcomeImage from '../../../../assets/login/welcome.png';
import { Button, Divider, SocialLoginButton, showToast } from '../../../../components';
import { errorMessage } from '@ziper/api/http';
import { LoadingOverlay } from '../common/LoadingOverlay';
import * as styles from './login.css';
import { useSocialLogin } from './useSocialLogin';

// 브릿지 어댑터가 준비되지 않은 경우(브라우저에 키가 없음 등)
const NOT_READY = ['UNSUPPORTED', 'AUTH_NOT_CONFIGURED'];

/** 시작 로그인 화면(RQ-AUTH-10). */
export function LoginPage() {
  const navigate = useNavigate();
  const { providers, lastProvider, busy, login } = useSocialLogin();

  async function loginWith(provider: Provider) {
    if (busy) return;
    try {
      const status = await login(provider);
      // 처음 온 사람은 약관 동의 → 가입 완료 화면으로 간다.
      if (status === 'signupRequired') navigate({ to: '/signup/terms' });
      else if (status === 'signedIn') navigate({ to: '/' });
    } catch (error) {
      const notReady = error instanceof BridgeError && NOT_READY.includes(error.code);
      showToast(
        notReady
          ? '소셜 로그인은 준비 중이에요'
          : errorMessage(error, '로그인하지 못했어요. 다시 시도해주세요'),
      );
    }
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
          {providers.map((provider) => (
            <div key={provider} className={styles.buttonSlot}>
              {lastProvider === provider && <RecentLoginTooltip />}
              <SocialLoginButton provider={provider} onClick={() => loginWith(provider)} />
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
            onClick={() => navigate({ to: '/login/email' })}
          >
            로그인 하기
          </button>
        </p>
      </div>

      {busy && <LoadingOverlay />}
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
