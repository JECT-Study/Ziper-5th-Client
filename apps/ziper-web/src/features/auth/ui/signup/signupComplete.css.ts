import { style } from '@vanilla-extract/css';
import { typography, vars } from '../../../../styles/theme.css';

export const screen = style({
  maxWidth: 480,
  minHeight: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
});

// Figma 에서 그래픽과 문구 묶음은 화면 가운데보다 20px 위에 있다.
export const main = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[4],
  padding: `0 ${vars.space[20]}`,
  marginTop: -40,
});

export const graphic = style({
  position: 'relative',
  width: 156,
  height: 156,
  overflow: 'hidden',
});

// 원본 이미지에서 Figma 와 같은 영역만 잘라 보여준다.
export const graphicCrop = style({
  position: 'absolute',
  top: -0.63,
  left: 'calc(50% + 0.63px)',
  width: 174.87,
  height: 154.74,
  transform: 'translateX(-50%)',
  overflow: 'hidden',
});

export const graphicImage = style({
  position: 'absolute',
  top: '-30.08%',
  left: '-20.24%',
  width: '140.47%',
  height: '173.98%',
  maxWidth: 'none',
});

export const title = style({
  margin: 0,
  ...typography.headline2Bold,
  color: vars.color.text.strong,
  textAlign: 'center',
});

export const footer = style({ position: 'sticky', bottom: 0 });
