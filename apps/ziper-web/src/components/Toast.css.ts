import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

// Figma 보드 화면 toast(835:9202): 좌우 16px 를 뺀 너비, 높이 46, 진한 회색, 12px 글자.
export const toast = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 46,
  padding: `${vars.space[12]} ${vars.space[16]}`,
  borderRadius: vars.radius.s,
  backgroundColor: vars.palette.gray800,
  color: vars.color.text.white,
  ...typography.body3Medium,
  textAlign: 'center',
  wordBreak: 'keep-all',
});

// Sonner 가 좌우 16px 를 띄운 칸을 준다. 그 안을 채우고, 넓은 화면에서는 앱 폭(480 - 32)에 맞춘다.
export const slot = style({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  maxWidth: 448,
  margin: '0 auto',
});

export const item = style({
  left: 0,
  right: 0,
  width: '100%',
});
