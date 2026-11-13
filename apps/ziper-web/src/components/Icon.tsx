import type { CSSProperties } from 'react';
import arrowUpRightFill from '../assets/icons/arrow-up-right-fill.svg';
import bellLine from '../assets/icons/bell-line.svg';
import chevronDownLine from '../assets/icons/chevron-down-line.svg';
import chevronLeftLine from '../assets/icons/chevron-left-line.svg';
import chevronRightLine from '../assets/icons/chevron-right-line.svg';
import chevronRightSmallLine from '../assets/icons/chevron-right-small-line.svg';
import chevronUpLine from '../assets/icons/chevron-up-line.svg';
import dot3HorizontalLine from '../assets/icons/dot3-horizontal-line.svg';
import eyeFill from '../assets/icons/eye-fill.svg';
import eyeSlashFill from '../assets/icons/eye-slash-fill.svg';
import gridFill from '../assets/icons/grid-fill.svg';
import gridLine from '../assets/icons/grid-line.svg';
import handPointUpFill from '../assets/icons/hand-point-up-fill.svg';
import handPointUpLine from '../assets/icons/hand-point-up-line.svg';
import houseFill from '../assets/icons/house-fill.svg';
import houseLine from '../assets/icons/house-line.svg';
import pencilFill from '../assets/icons/pencil-fill.svg';
import personFill from '../assets/icons/person-fill.svg';
import personLine from '../assets/icons/person-line.svg';
import plusFill from '../assets/icons/plus-fill.svg';
import plusSmallFill from '../assets/icons/plus-small-fill.svg';
import plusSmallLine from '../assets/icons/plus-small-line.svg';
import signupLoading from '../assets/icons/signup-loading.svg';
import xmarkCircleFill from '../assets/icons/xmark-circle-fill.svg';
import xmarkLine from '../assets/icons/xmark-line.svg';
import { cx } from './cx';
import * as styles from './Icon.css';

const ICONS = {
  'arrow-up-right-fill': arrowUpRightFill,
  'bell-line': bellLine,
  'chevron-down-line': chevronDownLine,
  'chevron-left-line': chevronLeftLine,
  'chevron-right-line': chevronRightLine,
  'chevron-right-small-line': chevronRightSmallLine,
  'chevron-up-line': chevronUpLine,
  'dot3-horizontal-line': dot3HorizontalLine,
  'eye-fill': eyeFill,
  'eye-slash-fill': eyeSlashFill,
  'grid-fill': gridFill,
  'grid-line': gridLine,
  'hand-point-up-fill': handPointUpFill,
  'hand-point-up-line': handPointUpLine,
  'house-fill': houseFill,
  'house-line': houseLine,
  'pencil-fill': pencilFill,
  'person-fill': personFill,
  'person-line': personLine,
  'plus-fill': plusFill,
  'plus-small-fill': plusSmallFill,
  'plus-small-line': plusSmallLine,
  'signup-loading': signupLoading,
  'xmark-circle-fill': xmarkCircleFill,
  'xmark-line': xmarkLine,
};

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  /** px. Figma 아이콘은 24 기준이고 버튼 안에서는 16·12 로 줄여 쓴다. */
  size?: number;
  /** 의미 있는 아이콘일 때만 넣는다. 없으면 스크린 리더가 건너뛴다. */
  label?: string;
  className?: string;
};

// SVG 를 마스크로 써서 currentColor 로 칠한다. 색은 부모의 color 를 따라간다.
export function Icon({ name, size = 24, label, className }: IconProps) {
  const style = {
    width: size,
    height: size,
    maskImage: `url("${ICONS[name]}")`,
    WebkitMaskImage: `url("${ICONS[name]}")`,
  } satisfies CSSProperties;
  return (
    <span
      className={cx(styles.icon, className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={cx(styles.spin, className)} role="status" aria-label="로딩 중">
      <Icon name="signup-loading" size={size} />
    </span>
  );
}
