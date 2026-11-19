import { BottomSheet, RNHostView } from '@expo/ui';
import type { SheetInput } from '@ziper/bridge/contract';
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
      containerColor="#ffffff"
      contentPadding={0}
    >
      <RNHostView>
        <View style={styles.panel} accessibilityViewIsModal>
          <Text accessible accessibilityRole="header" style={styles.title}>
            {input.title || '작업 선택'}
          </Text>
          <ScrollView nestedScrollEnabled style={styles.list} contentContainerStyle={styles.rows}>
            {input.actions.map((action) => (
              <SheetButton
                key={action.id}
                label={action.label}
                destructive={action.destructive}
                onPress={() => onSelect(action.id)}
              />
            ))}
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
  panel: { flex: 1, backgroundColor: '#ffffff' },
  title: { padding: 16, color: '#222222', fontSize: 20, fontWeight: '700' },
  list: { flex: 1 },
  rows: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  footer: { padding: 16 },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
  },
  pressed: { backgroundColor: '#e3e3e3' },
  label: { color: '#222222', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  destructive: { color: '#97000d' },
});
