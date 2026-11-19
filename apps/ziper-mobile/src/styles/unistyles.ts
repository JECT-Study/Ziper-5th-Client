import { colors, palette } from '@ziper/design-tokens';
import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: colors.background,
    text: palette.gray950,
  },
};

type AppThemes = {
  light: typeof lightTheme;
};

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: { light: lightTheme },
  settings: { initialTheme: 'light' },
});
