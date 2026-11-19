import { createGlobalTheme } from '@vanilla-extract/css';
import { colors, palette as sharedPalette, radius, space, typeScale } from '@ziper/design-tokens';

// Figma "Design_필수산출물_디자인시스템" 페이지의 Color·Typography 변수를 옮긴 것.
// 화면 코드에서는 palette 대신 의미가 붙은 color 토큰을 먼저 쓴다.

const palette = {
  ...sharedPalette,
  black: '#000000',
  gray500: '#a2a2a2',
  gray600: '#808080',
  gray700: '#595959',
  gray800: '#303030',
  lime50: '#f5fee5',
  lime100: '#e8fec4',
  lime200: '#d1fa8c',
  lime500: '#5cd100',
  lime700: '#357f00',
  lime800: '#2e6400',
  lime900: '#2b5500',
  red100: '#ffe7e9',
  red200: '#ffcacf',
  red300: '#ff939c',
  red400: '#ff616c',
  red500: '#d82c3b',
  red600: '#c00011',
  red800: '#6e000a',
  red900: '#460006',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  blue900: '#1e3a8a',
  blue950: '#172554',
  yellow50: '#fefce8',
  yellow100: '#fef9c3',
  yellow200: '#fef08a',
  yellow300: '#fde047',
  yellow400: '#facc15',
  yellow500: '#eab308',
  yellow600: '#ca8a04',
  yellow700: '#a16207',
  yellow800: '#854d0e',
  yellow900: '#713f12',
  yellow950: '#422006',
  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange200: '#fed7aa',
  orange300: '#fdba74',
  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange700: '#c2410c',
  orange800: '#9a3412',
  orange900: '#7c2d12',
  orange950: '#431407',
};

const px = (value: number) => `${value}px`;

export const vars = createGlobalTheme(':root', {
  palette,
  color: {
    primary: colors.primary,
    secondary: colors.secondary,
    text: {
      strong: colors.textStrong,
      default: palette.gray700,
      disabled: colors.textDisabled,
      destructive: colors.textDestructive,
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
    // positive 는 Figma Color 표에는 없고 텍스트 필드 완료 상태에서만 쓰인다.
    status: { negative: palette.red500, positive: palette.lime500 },
    accent: {
      yellow: palette.yellow300,
      red: '#ef4444',
      orange: palette.orange500,
      lime: palette.lime500,
      blue: palette.blue500,
    },
    overlay: { dimmed: 'rgba(0, 0, 0, 0.6)' },
    background: colors.background,
  },
  font: {
    family: "'Pretendard Variable', Pretendard, system-ui, sans-serif",
  },
  // Spacing 규칙: 4배수, 16 이하는 2배수도 허용. 키는 px 값 그대로.
  space: {
    2: px(space[2]),
    4: px(space[4]),
    6: '6px',
    8: px(space[8]),
    10: '10px',
    12: px(space[12]),
    14: '14px',
    16: px(space[16]),
    20: '20px',
    24: px(space[24]),
    32: '32px',
    40: '40px',
    48: '48px',
    56: '56px',
    64: '64px',
    72: '72px',
  },
  // Radius 규칙: 4 / 8 / 12 / 16 네 가지. sheet(24)와 full 은 컴포넌트에서 쓰는 예외 값.
  radius: {
    xs: px(radius.xs),
    s: px(radius.s),
    m: '12px',
    l: '16px',
    sheet: px(radius.sheet),
    full: '9999px',
  },
  shadow: { default: '0 4px 8px rgba(0, 0, 0, 0.08)' },
});

const textStyle = (token: { fontSize: number; fontWeight: number; lineHeight: number }) => ({
  ...token,
  lineHeight: px(token.lineHeight),
});

// style() 안에 펼쳐서 쓴다. 예: style({ ...typography.title3Bold, color: vars.color.text.strong })
export const typography = {
  headline1Bold: textStyle({ fontSize: 30, fontWeight: 700, lineHeight: 40 }),
  headline2Bold: textStyle({ fontSize: 24, fontWeight: 700, lineHeight: 34 }),
  title1Bold: textStyle(typeScale.title1Bold),
  title2Bold: textStyle({ fontSize: 18, fontWeight: 700, lineHeight: 24 }),
  title3Bold: textStyle(typeScale.title3Bold),
  subtitle1Bold: textStyle({ fontSize: 14, fontWeight: 700, lineHeight: 22 }),
  subtitle1Semibold: textStyle(typeScale.subtitle1Semibold),
  body1Medium: textStyle({ fontSize: 16, fontWeight: 500, lineHeight: 24 }),
  body2Medium: textStyle({ fontSize: 14, fontWeight: 500, lineHeight: 22 }),
  body3Medium: textStyle({ fontSize: 12, fontWeight: 500, lineHeight: 18 }),
  caption1Bold: textStyle(typeScale.caption1Bold),
  caption2Bold: textStyle({ fontSize: 10, fontWeight: 700, lineHeight: 16 }),
  caption2Medium: textStyle({ fontSize: 10, fontWeight: 500, lineHeight: 16 }),
};
