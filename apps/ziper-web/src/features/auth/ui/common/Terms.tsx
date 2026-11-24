import { Checkbox, Divider } from '../../../../components';
import { TERMS, type Agreements } from '../../model/terms';
import * as styles from './Terms.css';

// 약관 본문은 랜딩(ziper-landing)의 /terms/{service|privacy|marketing} 페이지에 있다.
// 앱 WebView 는 새 창을 직접 열지 않고, 이 주소만 기기 브라우저로 넘긴다(ziper-mobile web-screen).
const TERMS_URL = 'https://ziper.cc/terms';

/** 이용약관 동의 목록(전체 동의 + 항목별 동의). */
export function Terms({
  agreed,
  onChange,
}: {
  agreed: Agreements;
  onChange: (next: Agreements) => void;
}) {
  const allAgreed = TERMS.every((term) => agreed[term.id]);
  const agreeAll = (value: boolean) =>
    onChange({ service: value, privacy: value, marketing: value });

  return (
    <section className={styles.terms} aria-labelledby="terms-title">
      <p id="terms-title" className={styles.termsTitle}>
        이용약관동의
      </p>
      <Checkbox checked={allAgreed} onChange={(e) => agreeAll(e.target.checked)}>
        약관 전체 동의
      </Checkbox>
      <Divider />
      {TERMS.map((term) => (
        <div key={term.id} className={styles.termRow}>
          <Checkbox
            checked={agreed[term.id]}
            onChange={(e) => onChange({ ...agreed, [term.id]: e.target.checked })}
          >
            {term.label}
          </Checkbox>
          <a
            className={styles.termLink}
            href={`${TERMS_URL}/${term.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${term.label} 보기`}
          >
            보기
          </a>
        </div>
      ))}
    </section>
  );
}
