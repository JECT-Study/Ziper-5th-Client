import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../styles/theme.css';

export const base = style({ width: '100%', margin: 0, border: 'none' });

export const size = styleVariants({ sm: { height: 1 }, md: { height: 8 } });

export const tone = styleVariants({
  default: { backgroundColor: vars.color.divider.default },
  strong: { backgroundColor: vars.color.divider.strong },
});
