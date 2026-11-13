import { cx } from './cx';
import * as styles from './Toast.css';

/** 짧은 알림 문구. 띄우는 위치와 사라지는 시점은 쓰는 쪽에서 정한다. */
export function Toast({ children, className }: { children: string; className?: string }) {
  return (
    <div role="status" className={cx(styles.toast, className)}>
      {children}
    </div>
  );
}
