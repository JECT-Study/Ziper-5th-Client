import { style } from '@vanilla-extract/css';
import { typography, vars } from '../../../../styles/theme.css';

export const terms = style({
  marginTop: vars.space[32],
  paddingBottom: vars.space[24],
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[12],
});

export const termsTitle = style({
  margin: `0 0 ${vars.space[4]}`,
  ...typography.body2Medium,
  color: vars.color.text.default,
});

export const termRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[8],
});

export const termLink = style({
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  ...typography.body3Medium,
  fontFamily: 'inherit',
  color: vars.color.icon.default,
  cursor: 'pointer',
});
