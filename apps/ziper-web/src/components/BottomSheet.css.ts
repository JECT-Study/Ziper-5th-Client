import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const sheet = style({
  inset: 'auto 0 0',
  margin: '0 auto',
  width: '100%',
  maxWidth: 480,
  minHeight: 'min(244px, 100dvh)',
  maxHeight: 'min(650px, 100dvh)',
  borderTopLeftRadius: vars.radius.sheet,
  borderTopRightRadius: vars.radius.sheet,
  backgroundColor: vars.color.background,
  boxShadow: vars.shadow.default,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
});

export const handlerArea = style({
  display: 'flex',
  flexShrink: 0,
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
  minWidth: 0,
  margin: 0,
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
  ...typography.title1Bold,
  color: vars.color.text.strong,
});

export const close = style({
  display: 'inline-flex',
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.strong,
});

export const contents = style({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehaviorY: 'contain',
});

export const footer = style({ flexShrink: 0 });
