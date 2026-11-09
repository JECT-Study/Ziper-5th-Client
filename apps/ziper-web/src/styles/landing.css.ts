import { style } from '@vanilla-extract/css';

export const page = style({
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  textAlign: 'center',
});

export const title = style({
  margin: 0,
  fontSize: 48,
  letterSpacing: '-0.04em',
});

export const description = style({
  margin: 0,
  color: '#475569',
  lineHeight: 1.6,
});

export const link = style({
  color: '#1d4ed8',
  textUnderlineOffset: 4,
  ':focus-visible': {
    outline: '2px solid currentColor',
    outlineOffset: 4,
  },
});
