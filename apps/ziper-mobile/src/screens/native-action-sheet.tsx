import { BottomSheet, RNHostView } from '@expo/ui';
import type { SheetInput } from '@ziper/bridge/contract';
import { buttonHeight, colors, radius, space, typeScale } from '@ziper/design-tokens';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function NativeActionSheet({
  input,
  onSelect,
  onCancel,
}: {
  input: SheetInput;
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet
      isPresented
      onDismiss={onCancel}
      shouldDismissOnBackPress
      snapPoints={['half', 'full']}
      containerColor={colors.background}
      contentPadding={0}
    >
      <RNHostView>
        <View style={styles.panel} accessibilityViewIsModal>
          <ScrollView nestedScrollEnabled style={styles.list}>
            <Text accessible accessibilityRole="header" style={styles.title}>
              {input.title || '작업 선택'}
            </Text>
            <View style={styles.rows}>
              {input.actions.map((action) => (
                <SheetButton
                  key={action.id}
                  label={action.label}
                  destructive={action.destructive}
                  onPress={() => onSelect(action.id)}
                />
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <SheetButton label="취소" onPress={onCancel} />
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

function SheetButton({
  label,
  destructive,
  onPress,
}: {
  label: string;
  destructive?: boolean | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.background },
  title: { padding: space[16], color: colors.textStrong, ...typeScale.title1Bold },
  list: { flex: 1 },
  rows: { gap: space[8], paddingHorizontal: space[16], paddingVertical: space[4] },
  footer: { padding: space[16] },
  button: {
    minHeight: buttonHeight.large,
    cursor: 'pointer',
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.s,
    backgroundColor: colors.secondary.default,
  },
  pressed: { backgroundColor: colors.secondary.pressed },
  label: { ...typeScale.title3Bold, color: colors.textStrong, textAlign: 'center' },
  destructive: { color: colors.textDestructive },
});
