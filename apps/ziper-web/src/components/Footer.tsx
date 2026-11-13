import type { ReactNode } from 'react';
import { cx } from './cx';
import * as styles from './Footer.css';

type Layout = 'single' | 'split' | 'stack';

/** 버튼 묶음. split 은 가로 반반, stack 은 세로로 쌓는다. 모달 안에서도 쓴다. */
export function ButtonGroup({
  layout = 'single',
  children,
  className,
}: {
  layout?: Layout;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(styles.group[layout], className)}>{children}</div>;
}

/** 화면 하단 고정 영역의 버튼 묶음(흰 배경 + 16px 여백). */
export function Footer({
  layout,
  children,
  className,
}: {
  layout?: Layout;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ButtonGroup layout={layout} className={cx(styles.footer, className)}>
      {children}
    </ButtonGroup>
  );
}
