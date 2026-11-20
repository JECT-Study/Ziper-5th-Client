import { style } from '@vanilla-extract/css';
import { vars } from '../../../../styles/theme.css';

// 화면 전체를 막는다. Modal 과 같은 dim 토큰을 쓴다.
export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: vars.color.overlay.dimmed,
  // Spinner 는 부모 글자색으로 칠해진다.
  color: vars.color.icon.white,
});
