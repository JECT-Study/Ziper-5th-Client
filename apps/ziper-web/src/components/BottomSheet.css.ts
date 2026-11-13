import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  backgroundColor: vars.color.overlay.dimmed,
});

export const sheet = style({
  width: '100%',
  maxWidth: 480,
  minHeight: 244,
  maxHeight: 650,
  display: 'flex',
  flexDirection: 'column',
  borderTopLeftRadius: vars.radius.sheet,
  borderTopRightRadius: vars.radius.sheet,
  backgroundColor: vars.color.background,
  boxShadow: vars.shadow.default,
  paddingBottom: 'env(safe-area-inset-bottom)',
});

export const handlerArea = style({
  display: 'flex',
  justifyContent: 'center',
  minHeight: 20,
  padding: `${vars.space[12]} ${vars.space[16]} 0`,
});

// Figma surface/subtle(#f3f4f6). Color 표에 없는 값이라 여기서만 쓴다.
export const handler = style({
  width: 40,
  height: 3,
  borderRadius: vars.radius.full,
  backgroundColor: '#f3f4f6',
});

export const titleBar = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.space[16],
  padding: vars.space[16],
});

export const title = style({
  flex: 1,
  margin: 0,
  ...typography.title1Bold,
  color: vars.color.text.strong,
});

export const close = style({
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.strong,
  cursor: 'pointer',
});

export const contents = style({ flex: 1, overflowY: 'auto' });
