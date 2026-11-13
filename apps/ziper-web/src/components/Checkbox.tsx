import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import * as styles from './Checkbox.css';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
};

export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles.root, className)}>
      <input type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden />
      {children && <span className={styles.label}>{children}</span>}
    </label>
  );
}
