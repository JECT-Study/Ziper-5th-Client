import { style, styleVariants } from '@vanilla-extract/css';
import { buttonHeight } from '@ziper/design-tokens';
import { typography, vars } from '../styles/theme.css';

// 로딩 중에도 disabled 속성이 붙지만, 색은 비활성이 아니라 기본 상태를 유지한다.
const DISABLED = '&:disabled:not([aria-busy="true"])';
const PRESSED = '&:active:not(:disabled)';

export const base = style({
  display: 'inline-grid',
  placeItems: 'center',
  border: 'none',
  color: vars.color.text.strong,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  selectors: {
    [DISABLED]: { color: vars.color.text.disabled },
  },
  ':focus-visible': { outline: `2px solid ${vars.palette.lime600}`, outlineOffset: 2 },
});

export const content = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'inherit',
  gridArea: '1 / 1',
  // Keep the accessible name and width when swapping the visible label for a spinner.
  selectors: { [`${base}[aria-busy="true"] > &`]: { opacity: 0 } },
});

export const loadingIcon = style({ display: 'inline-flex', gridArea: '1 / 1' });

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
    height: buttonHeight.large,
    padding: `0 ${vars.space[16]}`,
    gap: vars.space[4],
    borderRadius: vars.radius.s,
    ...typography.title3Bold,
  },
  medium: {
    width: '100%',
    height: buttonHeight.medium,
    padding: `0 ${vars.space[16]}`,
    gap: vars.space[2],
    borderRadius: vars.radius.s,
    ...typography.subtitle1Semibold,
  },
  small: {
    width: 'fit-content',
    height: buttonHeight.small,
    padding: `0 ${vars.space[12]}`,
    gap: vars.space[2],
    borderRadius: vars.radius.xs,
    ...typography.caption1Bold,
  },
});
