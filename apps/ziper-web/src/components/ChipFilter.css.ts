import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[4],
  padding: `${vars.space[8]} ${vars.space[16]}`,
  border: 'none',
  borderRadius: vars.radius.full,
  backgroundColor: vars.palette.gray150,
  color: vars.color.text.strong,
  fontFamily: 'inherit',
  ...typography.subtitle1Semibold,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  ':focus-visible': { outline: `2px solid ${vars.palette.lime600}`, outlineOffset: 2 },
});

export const selected = style({
  backgroundColor: vars.palette.gray900,
  color: vars.color.text.white,
});
