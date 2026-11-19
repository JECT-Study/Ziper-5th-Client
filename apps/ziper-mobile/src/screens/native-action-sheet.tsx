import { BottomSheet, RNHostView } from '@expo/ui';
import type { SheetInput } from '@ziper/bridge/contract';
import { colors, space, typeScale } from '@ziper/design-tokens';
import { Button } from '@ziper/ui/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
                <Button
                  key={action.id}
                  label={action.label}
                  destructive={action.destructive}
                  onPress={() => onSelect(action.id)}
                />
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Button label="취소" onPress={onCancel} />
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.background },
  title: { padding: space[16], color: colors.textStrong, ...typeScale.title1Bold },
  list: { flex: 1 },
  rows: { gap: space[8], paddingHorizontal: space[16], paddingVertical: space[4] },
  footer: { padding: space[16] },
});
