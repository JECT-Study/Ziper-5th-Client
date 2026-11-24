import { useNavigate } from '@tanstack/react-router';
import checkGraphic from '../../../../assets/signup/complete-check.png';
import { Button, Footer } from '../../../../components';
import * as styles from './signupComplete.css';

/** 가입 완료(RQ-AUTH-12). [시작하기]를 누르면 홈으로 간다. */
export function SignupCompletePage() {
  const navigate = useNavigate();
  return (
    <div className={styles.screen}>
      <main className={styles.main}>
        <div className={styles.graphic} aria-hidden>
          <div className={styles.graphicCrop}>
            <img className={styles.graphicImage} src={checkGraphic} alt="" />
          </div>
        </div>
        <h1 className={styles.title}>회원가입이 완료되었어요.</h1>
      </main>
      <Footer className={styles.footer}>
        <Button onClick={() => navigate({ to: '/' })}>시작하기</Button>
      </Footer>
    </div>
  );
}
