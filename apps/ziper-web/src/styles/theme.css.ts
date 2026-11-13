import { createGlobalTheme } from '@vanilla-extract/css';

// Figma "Design_필수산출물_디자인시스템" 페이지의 Color·Typography 변수를 옮긴 것.
// 화면 코드에서는 palette 대신 의미가 붙은 color 토큰을 먼저 쓴다.

const palette = {
  white: '#ffffff',
  black: '#000000',
  gray100: '#f6f6f6',
  gray150: '#f1f1f1',
  gray200: '#ebebeb',
  gray300: '#e3e3e3',
  gray400: '#c2c2c2',
  gray500: '#a2a2a2',
  gray600: '#808080',
  gray700: '#595959',
  gray800: '#303030',
  gray900: '#222222',
  gray950: '#111111',
  lime50: '#f5fee5',
  lime100: '#e8fec4',
  lime200: '#d1fa8c',
  lime300: '#abf61c',
  lime400: '#81e900',
  lime500: '#5cd100',
  lime600: '#41a700',
  lime700: '#357f00',
  lime800: '#2e6400',
  lime900: '#2b5500',
  red100: '#ffe7e9',
  red200: '#ffcacf',
  red300: '#ff939c',
  red400: '#ff616c',
  red500: '#d82c3b',
  red600: '#c00011',
  red700: '#97000d',
  red800: '#6e000a',
  red900: '#460006',
};

export const vars = createGlobalTheme(':root', {
  palette,
  color: {
    primary: { default: palette.lime300, pressed: palette.lime400, disabled: palette.gray200 },
    secondary: { default: palette.gray150, pressed: palette.gray300, disabled: palette.gray100 },
    text: {
      strong: palette.gray900,
      default: palette.gray700,
      disabled: palette.gray400,
      placeholder: palette.gray300,
      brand: palette.lime400,
      white: palette.white,
    },
    icon: {
      strong: palette.gray900,
      default: palette.gray600,
      disabled: palette.gray400,
      white: palette.white,
    },
    border: { default: palette.gray600, disabled: palette.gray300, subtle: palette.gray200 },
    divider: { default: palette.gray100, strong: palette.gray200 },
    status: { negative: palette.red500 },
    accent: {
      yellow: '#fde047',
      red: '#ef4444',
      orange: '#f97316',
      lime: palette.lime500,
      blue: '#3b82f6',
    },
    overlay: { dimmed: 'rgba(0, 0, 0, 0.6)' },
    background: palette.white,
  },
  font: {
    family: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
  },
  // Figma 화면에 쓰인 값만 옮겼다. Spacing·radius 정리 프레임에는 변수가 연결돼 있지 않다.
  space: { '2xs': '4px', sm: '8px', lg: '16px', xl: '20px' },
  radius: { s: '8px' },
});

const textStyle = (fontSize: number, fontWeight: 500 | 700, lineHeight: number) => ({
  fontSize,
  fontWeight,
  lineHeight: `${lineHeight}px`,
});

// style() 안에 펼쳐서 쓴다. 예: style({ ...typography.title3Bold, color: vars.color.text.strong })
export const typography = {
  headline1Bold: textStyle(30, 700, 40),
  headline2Bold: textStyle(24, 700, 34),
  title1Bold: textStyle(20, 700, 28),
  title2Bold: textStyle(18, 700, 24),
  title3Bold: textStyle(16, 700, 22),
  subtitle1Bold: textStyle(14, 700, 22),
  body1Medium: textStyle(16, 500, 24),
  body2Medium: textStyle(14, 500, 22),
  body3Medium: textStyle(12, 500, 18),
  caption1Bold: textStyle(12, 700, 18),
  caption2Bold: textStyle(10, 700, 16),
  caption2Medium: textStyle(10, 500, 16),
};
