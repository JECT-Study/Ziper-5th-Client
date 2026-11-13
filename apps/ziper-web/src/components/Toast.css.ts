import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const toast = style({
  display: 'inline-flex',
  width: 'fit-content',
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderRadius: vars.radius.s,
  backgroundColor: vars.palette.black,
  color: vars.color.text.white,
  ...typography.body2Medium,
  textAlign: 'center',
});
