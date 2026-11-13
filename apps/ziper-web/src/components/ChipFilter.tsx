import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import * as styles from './ChipFilter.css';

type ChipFilterProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function ChipFilter({
  selected = false,
  className,
  type = 'button',
  ...rest
}: ChipFilterProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(styles.base, selected && styles.selected, className)}
      {...rest}
    />
  );
}
