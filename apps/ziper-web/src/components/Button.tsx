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
      <span className={styles.content}>
        {/* 로딩 중에는 왼쪽 아이콘 자리에 스피너를 두고 글자는 그대로 보여준다. */}
        {loading ? (
          // 버튼 이름은 글자만 읽히도록 스피너는 보조기기에서 숨긴다(aria-busy 로 로딩을 알린다).
          <span className={styles.loadingIcon} aria-hidden="true">
            <Spinner size={ICON_SIZE[size]} />
          </span>
        ) : (
          leftIcon && <Icon name={leftIcon} size={ICON_SIZE[size]} />
        )}
        {children}
        {rightIcon && <Icon name={rightIcon} size={ICON_SIZE[size]} />}
      </span>
    </button>
  );
}
