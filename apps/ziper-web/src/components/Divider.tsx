import { cx } from './cx';
import * as styles from './Divider.css';

type DividerProps = {
  /** sm 1px 선 · md 8px 영역 구분 */
  size?: 'sm' | 'md';
  tone?: 'default' | 'strong';
  className?: string;
};

export function Divider({ size = 'sm', tone = 'default', className }: DividerProps) {
  return <hr className={cx(styles.base, styles.size[size], styles.tone[tone], className)} />;
}
