import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ButtonOptions } from '../button-options';
import * as styles from './button.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonOptions & {
    variant?: 'primary' | 'secondary';
    size?: 'large' | 'medium' | 'small';
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    loadingIcon?: ReactNode;
  };

export function Button({
  variant = 'primary',
  size = 'large',
  destructive = false,
  loading = false,
  leftIcon,
  rightIcon,
  loadingIcon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.base,
    styles.variant[variant],
    styles.size[size],
    destructive && styles.destructive,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span
        className={styles.content}
        data-loading-replaced={loading && loadingIcon ? 'true' : undefined}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </span>
      {loading && loadingIcon && (
        <span className={styles.loadingIcon} aria-hidden="true">
          {loadingIcon}
        </span>
      )}
    </button>
  );
}
