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
  display: 'grid',
  placeContent: 'center',
  gap: vars.space[16],
  padding: vars.space[24],
  textAlign: 'center',
});

export const title = style({
  margin: 0,
  fontSize: 48,
  letterSpacing: '-0.04em',
});

export const description = style({
  margin: 0,
  color: vars.color.text.default,
  lineHeight: 1.6,
});

export const error = style({ margin: 0, color: vars.color.status.negative });
