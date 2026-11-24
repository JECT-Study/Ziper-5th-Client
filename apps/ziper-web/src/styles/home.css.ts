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
  paddingTop: vars.space[16],
});

export const error = style({
  margin: 0,
  padding: `0 ${vars.space[16]}`,
  color: vars.color.status.negative,
});
