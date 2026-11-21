import { style } from '@vanilla-extract/css';
import { vars } from '../../../../styles/theme.css';

export const failed = style({
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[16],
  padding: vars.space[24],
  textAlign: 'center',
});
