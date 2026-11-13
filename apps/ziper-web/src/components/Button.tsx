import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon, Spinner, type IconName } from './Icon';
import * as styles from './Button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  /** large 48 · medium 40 · small 32. large·medium 은 부모 너비를 채운다. */
  size?: 'large' | 'medium' | 'small';
  loading?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
};

const ICON_SIZE = { large: 24, medium: 16, small: 12 } as const;
const SPINNER_SIZE = { large: 24, medium: 24, small: 16 } as const;

export function Button({
  variant = 'primary',
  size = 'large',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.base, styles.variant[variant], styles.size[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size={SPINNER_SIZE[size]} />
      ) : (
        <>
          {leftIcon && <Icon name={leftIcon} size={ICON_SIZE[size]} />}
          {children}
          {rightIcon && <Icon name={rightIcon} size={ICON_SIZE[size]} />}
        </>
      )}
    </button>
  );
}
