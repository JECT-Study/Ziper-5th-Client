import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

// 화면 높이를 고정하고 안쪽만 스크롤하면, 웹에서 480px 기둥 바깥(양옆 여백)에서 굴린 휠이 먹지 않는다.
// 그래서 문서 스크롤은 그대로 두고 네비만 화면 아래에 붙인다.
// body 의 아래 safe-area 여백(global.css.ts)까지 내려가 덮어서, 홈 인디케이터 뒤에 내용이 비치지 않게 한다.
const safeBottom = 'env(safe-area-inset-bottom, 0px)';

export const root = style({
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  marginBottom: `calc(-1 * ${safeBottom})`,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) clamp(50px, 20%, 74px) minmax(0, 1fr)',
  alignItems: 'center',
  padding: `${vars.space[12]} 0 calc(${vars.space[12]} + ${safeBottom})`,
  borderTop: `1px solid ${vars.color.border.subtle}`,
  backgroundColor: vars.color.background,
});

export const group = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  selectors: { '&:nth-child(2)': { gridColumn: 3 } },
});

export const tab = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[4],
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.disabled,
  fontFamily: 'inherit',
});

export const active = style({ color: vars.color.text.strong });

export const label = style({ ...typography.caption2Bold, textAlign: 'center' });

export const add = style({
  position: 'absolute',
  top: -16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.full,
  background: 'none',
  ':disabled': { opacity: 0.5 },
});
