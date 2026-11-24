import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const card = style({
  inset: 0,
  margin: 'auto',
  width: 'calc(100% - 32px)',
  maxWidth: 313,
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
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

// 여러 줄 안내는 문구 속 줄바꿈을 그대로 보여준다.
export const description = style({ margin: 0, ...typography.body2Medium, whiteSpace: 'pre-line' });
