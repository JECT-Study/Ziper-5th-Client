import { style } from '@vanilla-extract/css';
import { vars } from './theme.css';
import { viewportHeight } from './viewport';

export const page = style({
  minHeight: viewportHeight,
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
});

export const content = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: vars.space[16],
});
