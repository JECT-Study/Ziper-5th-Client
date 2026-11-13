import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.space[32],
  backgroundColor: vars.color.overlay.dimmed,
});

export const card = style({
  width: '100%',
  maxWidth: 313,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[24],
  padding: `${vars.space[32]} ${vars.space[16]} ${vars.space[16]}`,
  borderRadius: vars.radius.l,
  backgroundColor: vars.color.background,
});

export const contents = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[4],
  textAlign: 'center',
  color: vars.color.text.strong,
});

export const title = style({ margin: 0, ...typography.title2Bold });

export const description = style({ margin: 0, ...typography.body2Medium });
