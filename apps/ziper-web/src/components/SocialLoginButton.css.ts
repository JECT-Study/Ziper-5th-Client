import { style, styleVariants } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

const base = style({
  position: 'relative',
  width: '100%',
  height: 48,
  padding: `0 ${vars.space[20]}`,
  border: 'none',
  borderRadius: vars.radius.s,
  fontFamily: 'inherit',
  ...typography.title3Bold,
  textAlign: 'center',
  cursor: 'pointer',
  ':disabled': { opacity: 0.6, cursor: 'default' },
  ':focus-visible': { outline: `2px solid ${vars.palette.lime600}`, outlineOffset: 2 },
});

// 카카오 노랑과 네이버 테두리는 각 사의 로그인 버튼 가이드 색이라 토큰에 없다.
export const button = styleVariants({
  naver: [
    base,
    {
      backgroundColor: vars.color.background,
      border: '1px solid rgba(0, 0, 0, 0.15)',
      color: vars.color.text.strong,
    },
  ],
  kakao: [base, { backgroundColor: '#fee500', color: vars.color.text.strong }],
  apple: [base, { backgroundColor: vars.palette.gray950, color: vars.color.text.white }],
});

const logoBase = style({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
});

export const logo = styleVariants({
  naver: [logoBase, { left: 19, width: 20, height: 20 }],
  kakao: [logoBase, { left: 23, width: 18, height: 18 }],
  apple: [logoBase, { left: 20, width: 24, height: 24 }],
});
