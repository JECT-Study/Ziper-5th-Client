import { buttonHeight, colors, radius, space, typeScale } from '@ziper/design-tokens';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ButtonOptions } from '../button-options';

export type ButtonProps = ButtonOptions & {
  label: string;
  onPress: () => void;
};

/** Secondary action used in the native sheet. */
export function Button({ label, onPress, destructive, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, disabled ? styles.disabled : pressed && styles.pressed]}
    >
      <Text
        style={[styles.label, disabled ? styles.disabledLabel : destructive && styles.destructive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    minHeight: buttonHeight.large,
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondary.default,
    borderRadius: radius.s,
    cursor: 'pointer',
  },
  pressed: { backgroundColor: colors.secondary.pressed },
  disabled: { backgroundColor: colors.secondary.disabled, cursor: 'auto' },
  label: { ...typeScale.title3Bold, color: colors.textStrong, textAlign: 'center' },
  disabledLabel: { color: colors.textDisabled },
  destructive: { color: colors.textDestructive },
});
