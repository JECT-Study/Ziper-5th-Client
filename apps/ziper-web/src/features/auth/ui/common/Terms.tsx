import { Checkbox, Divider } from '../../../../components';
import { TERMS, type Agreements } from '../../model/terms';
import * as styles from './Terms.css';

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
          {/* TODO(JEC-85): 랜딩(ziper-landing)의 /terms/{service|privacy|marketing} 페이지로 연결한다. */}
          <button type="button" className={styles.termLink}>
            보기
          </button>
        </div>
      ))}
    </section>
  );
}
