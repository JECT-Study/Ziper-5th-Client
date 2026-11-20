import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const screen = style({
  maxWidth: 480,
  minHeight: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
});

export const main = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: `0 ${vars.space[16]}`,
});

// Figma 에서 입력칸은 제목 길이와 상관없이 헤더 아래 124px 에서 시작한다.
export const intro = style({
  minHeight: 124,
  paddingTop: 28,
  display: 'flex',
  flexDirection: 'column',
});

export const eyebrow = style({
  margin: `0 0 ${vars.space[4]}`,
  ...typography.body2Medium,
  color: vars.color.text.default,
});

export const title = style({
  margin: 0,
  ...typography.headline2Bold,
  color: vars.color.text.strong,
  wordBreak: 'break-all',
});

export const description = style({
  margin: `${vars.space[8]} 0 0`,
  ...typography.body2Medium,
  color: vars.color.text.default,
});

export const bottom = style({
  position: 'sticky',
  bottom: 0,
});
