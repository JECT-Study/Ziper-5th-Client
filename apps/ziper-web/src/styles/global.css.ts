import { globalStyle } from '@vanilla-extract/css';
import { vars } from './theme.css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
});

globalStyle('body', {
  margin: 0,
  backgroundColor: vars.color.background,
  color: vars.color.text.strong,
  fontFamily: vars.font.family,
});
