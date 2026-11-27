// Shared values from the Figma design system. The renderer supplies CSS units or native dp/pt.
export const palette = {
  white: '#ffffff',
  gray100: '#f6f6f6',
  gray150: '#f1f1f1',
  gray200: '#ebebeb',
  gray300: '#e3e3e3',
  gray400: '#c2c2c2',
  gray900: '#222222',
  gray950: '#111111',
  lime100: '#e8fec4',
  lime300: '#abf61c',
  lime400: '#81e900',
  lime600: '#41a700',
  red700: '#97000d',
} as const;

export const colors = {
  background: palette.white,
  textStrong: palette.gray900,
  textDisabled: palette.gray400,
  textDestructive: palette.red700,
  primary: { default: palette.lime300, pressed: palette.lime400, disabled: palette.gray200 },
  secondary: { default: palette.gray150, pressed: palette.gray300, disabled: palette.gray100 },
} as const;

export const space = { 2: 2, 4: 4, 8: 8, 12: 12, 16: 16, 24: 24 } as const;
export const radius = { xs: 4, s: 8, sheet: 24 } as const;
export const buttonHeight = { large: 48, medium: 40, small: 32 } as const;

export const typeScale = {
  title1Bold: { fontSize: 20, fontWeight: 700, lineHeight: 28 },
  title3Bold: { fontSize: 16, fontWeight: 700, lineHeight: 22 },
  subtitle1Semibold: { fontSize: 14, fontWeight: 600, lineHeight: 22 },
  caption1Bold: { fontSize: 12, fontWeight: 700, lineHeight: 18 },
} as const;
