import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const root = style({
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: vars.space[4],
  borderRadius: vars.radius.full,
  backgroundColor: vars.palette.gray100,
});

export const item = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[4],
  minWidth: 60,
  height: 36,
  padding: `${vars.space[8]} ${vars.space[12]}`,
  border: 'none',
  borderRadius: vars.radius.full,
  background: 'none',
  color: vars.color.text.default,
  fontFamily: 'inherit',
  ...typography.body2Medium,
  cursor: 'pointer',
});

export const selected = style({
  backgroundColor: vars.color.background,
  boxShadow: vars.shadow.default,
  color: vars.color.text.strong,
});
