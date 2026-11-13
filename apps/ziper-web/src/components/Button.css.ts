import { style, styleVariants } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

// 로딩 중에도 disabled 속성이 붙지만, 색은 비활성이 아니라 기본 상태를 유지한다.
const DISABLED = '&:disabled:not([aria-busy="true"])';
const PRESSED = '&:active:not(:disabled)';

export const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  color: vars.color.text.strong,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'default' },
    [DISABLED]: { color: vars.color.text.disabled },
  },
  ':focus-visible': { outline: `2px solid ${vars.palette.lime600}`, outlineOffset: 2 },
});

export const variant = styleVariants({
  primary: {
    backgroundColor: vars.color.primary.default,
    selectors: {
      [PRESSED]: { backgroundColor: vars.color.primary.pressed },
      [DISABLED]: { backgroundColor: vars.color.primary.disabled },
    },
  },
  secondary: {
    backgroundColor: vars.color.secondary.default,
    selectors: {
      [PRESSED]: { backgroundColor: vars.color.secondary.pressed },
      [DISABLED]: { backgroundColor: vars.color.secondary.disabled },
    },
  },
});

export const size = styleVariants({
  large: {
    width: '100%',
    height: 48,
    padding: `0 ${vars.space[16]}`,
    gap: vars.space[4],
    borderRadius: vars.radius.s,
    ...typography.title3Bold,
  },
  medium: {
    width: '100%',
    height: 40,
    padding: `0 ${vars.space[16]}`,
    gap: vars.space[2],
    borderRadius: vars.radius.s,
    ...typography.subtitle1Semibold,
  },
  small: {
    width: 'fit-content',
    height: 32,
    padding: `0 ${vars.space[12]}`,
    gap: vars.space[2],
    borderRadius: vars.radius.xs,
    ...typography.caption1Bold,
  },
});
