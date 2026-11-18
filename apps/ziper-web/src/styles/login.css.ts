import { style } from '@vanilla-extract/css';
import { typography, vars } from './theme.css';

// 수치는 Figma RQ-AUTH-10 (375 x 812, 상태 표시줄 44 제외) 기준.
// 68·-43·34 처럼 토큰에 없는 값은 Figma 요소 위치에서 계산한 레이아웃 간격이다.

export const page = style({
  maxWidth: 480,
  margin: '0 auto',
  paddingTop: 68,
  paddingBottom: vars.space[24],
});

export const illustration = style({
  position: 'relative',
  height: 162,
});

export const illustrationImage = style({
  display: 'block',
  width: 180,
  height: 162,
  objectFit: 'cover',
});

// 일러스트 아래쪽을 흰색으로 흐리게 덮어 문구와 자연스럽게 이어지게 한다.
export const illustrationFade = style({
  position: 'absolute',
  top: 68,
  left: 0,
  right: 0,
  height: 87,
  background: `linear-gradient(to bottom, rgba(255, 255, 255, 0), ${vars.color.background} 70%)`,
});

export const welcome = style({
  position: 'relative',
  marginTop: -43,
  padding: `${vars.space[12]} ${vars.space[16]}`,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[16],
});

export const heading = style({
  margin: 0,
  ...typography.headline1Bold,
  color: vars.color.icon.strong,
});

export const description = style({
  margin: 0,
  ...typography.body1Medium,
  color: vars.color.icon.default,
});

export const actions = style({
  marginTop: 34,
  padding: `0 ${vars.space[16]}`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[16],
});

export const socialButtons = style({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[8],
});

export const buttonSlot = style({
  position: 'relative',
});

// 말풍선 꼬리가 버튼 위쪽에 10px 겹친다.
export const tooltip = style({
  position: 'absolute',
  bottom: 'calc(100% - 10px)',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'none',
});

export const tooltipBubble = style({
  padding: `${vars.space[4]} ${vars.space[8]}`,
  borderRadius: vars.radius.s,
  backgroundColor: vars.palette.gray800,
  color: vars.color.text.white,
  ...typography.body2Medium,
  whiteSpace: 'nowrap',
});

export const tooltipTail = style({
  display: 'block',
  width: 29.09,
  height: 8,
});

export const signInRow = style({
  margin: `calc(-1 * ${vars.space[4]}) 0 0`,
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[8],
  ...typography.body3Medium,
});

export const signInHint = style({
  color: vars.color.text.disabled,
});

export const signInLink = style({
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.palette.lime600,
  font: 'inherit',
  cursor: 'pointer',
});

// 홈 인디케이터(안전 영역) 위에 띄운다.
export const toast = style({
  position: 'fixed',
  left: '50%',
  bottom: `calc(${vars.space[24]} + env(safe-area-inset-bottom))`,
  transform: 'translateX(-50%)',
  zIndex: 10,
  whiteSpace: 'nowrap',
});
