import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '../styles/theme.css';

export const dialog = style({
  position: 'fixed',
  border: 0,
  padding: 0,
  color: vars.color.text.strong,
  backgroundColor: vars.color.background,
  flexDirection: 'column',
  selectors: { '&[open]': { display: 'flex' } },
  '::backdrop': { backgroundColor: vars.color.overlay.dimmed },
});

globalStyle(`${dialog}[data-dismiss-on-backdrop]::backdrop`, { cursor: 'pointer' });
globalStyle(`body:has(${dialog}[open])`, { overflow: 'hidden' });
