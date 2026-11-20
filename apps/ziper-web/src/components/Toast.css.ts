import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const toast = style({
  display: 'inline-flex',
  width: 'fit-content',
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderRadius: vars.radius.s,
  backgroundColor: vars.palette.black,
  color: vars.color.text.white,
  ...typography.body2Medium,
  textAlign: 'center',
});

// Sonner 는 토스트 칸을 화면 너비로 잡으므로, 그 안에서 가운데에 놓는다.
export const slot = style({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
});

export const item = style({
  left: 0,
  right: 0,
  width: '100%',
});
