import { style } from '@vanilla-extract/css';
import { typography, vars } from './global.css';

export const main = style({
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[16],
  padding: vars.space[24],
});

export const title = style({ margin: 0, lineHeight: 0 });

export const logo = style({ width: 114, height: 36 });

export const description = style({
  margin: 0,
  ...typography.title2Bold,
  color: vars.color.text.default,
});
