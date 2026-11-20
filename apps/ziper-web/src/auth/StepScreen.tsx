import type { ReactNode } from 'react';
import { Footer, HeaderSub, Toast } from '../components';
import * as styles from './StepScreen.css';

type StepScreenProps = {
  /** 헤더 가운데 제목. 없으면 뒤로 가기만 보인다. */
  headerTitle?: string;
  onBack: () => void;
  /** 큰 제목 위에 붙는 작은 안내 문구 */
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** 하단 버튼들 */
  actions: ReactNode;
  actionsLayout?: 'single' | 'stack';
  /** 하단 버튼 바로 위에 띄우는 알림 문구 */
  toast?: string | null;
};

/** 회원가입·이메일 로그인 단계 화면의 공통 틀(RQ-AUTH-13·14·16): 헤더, 제목, 입력 영역, 하단 버튼. */
export function StepScreen({
  headerTitle = '',
  onBack,
  eyebrow,
  title,
  description,
  children,
  actions,
  actionsLayout = 'single',
  toast,
}: StepScreenProps) {
  return (
    <div className={styles.screen}>
      <HeaderSub title={headerTitle} onBack={onBack} />
      <main className={styles.main}>
        <div className={styles.intro}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {children}
      </main>
      <div className={styles.bottom}>
        {toast && <Toast className={styles.toast}>{toast}</Toast>}
        <Footer layout={actionsLayout}>{actions}</Footer>
      </div>
    </div>
  );
}
