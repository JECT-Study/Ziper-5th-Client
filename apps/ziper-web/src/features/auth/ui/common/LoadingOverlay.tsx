import { Spinner } from '../../../../components';
import * as styles from './LoadingOverlay.css';

/** 로그인이 끝날 때까지 화면 전체를 어둡게 덮고 스피너만 보여준다. */
export function LoadingOverlay() {
  return (
    <div className={styles.overlay} aria-busy>
      <Spinner size={32} />
    </div>
  );
}
