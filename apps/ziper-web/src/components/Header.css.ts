import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const main = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: vars.space[16],
  backgroundColor: vars.color.background,
});

export const sub = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  height: 56,
  padding: vars.space[16],
  backgroundColor: vars.color.background,
});

export const title = style({
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  margin: 0,
  ...typography.title2Bold,
  color: vars.color.text.strong,
  whiteSpace: 'nowrap',
});

export const right = style({ marginLeft: 'auto', display: 'flex' });

export const iconButton = style({
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.strong,
  cursor: 'pointer',
});
