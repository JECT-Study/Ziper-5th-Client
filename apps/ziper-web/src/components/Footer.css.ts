import { globalStyle, styleVariants, style } from '@vanilla-extract/css';
import { vars } from '../styles/theme.css';

export const group = styleVariants({
  single: { display: 'flex', gap: vars.space[8] },
  split: { display: 'flex', gap: vars.space[8] },
  stack: { display: 'flex', flexDirection: 'column', gap: vars.space[8] },
});

globalStyle(`${group.split} > *`, { flex: 1, minWidth: 0 });

export const footer = style({
  padding: vars.space[16],
  backgroundColor: vars.color.background,
});
