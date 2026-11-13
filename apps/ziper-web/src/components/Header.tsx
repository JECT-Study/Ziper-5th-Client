import type { ReactNode } from 'react';
import logo from '../assets/brand/ziper-logo.svg';
import { cx } from './cx';
import { Icon } from './Icon';
import * as styles from './Header.css';

/** 홈처럼 최상위 화면의 헤더. 왼쪽 로고, 오른쪽 자리(right)에 아이콘 버튼 등을 넣는다. */
export function HeaderMain({ right, className }: { right?: ReactNode; className?: string }) {
  return (
    <header className={cx(styles.main, className)}>
      <img src={logo} alt="Ziper" width={76} height={24} />
      {right}
    </header>
  );
}

type HeaderSubProps = {
  title: string;
  /** 있으면 왼쪽에 뒤로 가기 버튼을 보여준다. */
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
};

/** 하위 화면의 헤더. 가운데 제목, 왼쪽 뒤로 가기, 오른쪽 자리(right). */
export function HeaderSub({ title, onBack, right, className }: HeaderSubProps) {
  return (
    <header className={cx(styles.sub, className)}>
      {onBack && (
        <button type="button" className={styles.iconButton} onClick={onBack} aria-label="뒤로 가기">
          <Icon name="chevron-left-line" />
        </button>
      )}
      <h1 className={styles.title}>{title}</h1>
      {right && <div className={styles.right}>{right}</div>}
    </header>
  );
}

/** 헤더 오른쪽 자리에 넣는 24px 아이콘 버튼. */
export function HeaderIconButton({
  icon,
  label,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={styles.iconButton} onClick={onClick} aria-label={label}>
      <Icon name={icon} />
    </button>
  );
}
