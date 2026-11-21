import { buttonHeight, colors, radius, space, typeScale } from '@ziper/design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// WebView 가 페이지를 불러오지 못했을 때 기본 오류 화면(도메인·오류 코드) 대신 보여 준다.
export function WebLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Text accessibilityRole="alert" style={styles.title}>
        화면을 불러오지 못했어요
      </Text>
      <Text style={styles.body}>네트워크 연결을 확인한 뒤 다시 시도해 주세요.</Text>
      <Pressable
        testID="web-retry"
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[8],
    padding: space[24],
    backgroundColor: colors.background,
  },
  title: { ...typeScale.title1Bold, color: colors.textStrong, textAlign: 'center' },
  body: { ...typeScale.subtitle1Semibold, color: colors.textStrong, textAlign: 'center' },
  button: {
    minHeight: buttonHeight.large,
    marginTop: space[16],
    paddingHorizontal: space[24],
    justifyContent: 'center',
    borderRadius: radius.s,
    backgroundColor: colors.secondary.default,
  },
  pressed: { backgroundColor: colors.secondary.pressed },
  label: { ...typeScale.title3Bold, color: colors.textStrong },
});
