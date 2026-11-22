import { BottomSheet, RNHostView } from '@expo/ui';
import type { SheetInput } from '@ziper/bridge/contract';
import { buttonHeight, colors, radius, space, typeScale } from '@ziper/design-tokens';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

// 시트는 내용 높이에 맞춰 열고(snapPoints 없음), 목록이 길면 목록만 스크롤한다.
// snapPoints 에 'full' 을 넣으면 내용이 항상 화면 높이로 늘어나 'half' 상태에서 취소 버튼이 화면 밖으로 밀린다.
const LIST_MAX_RATIO = 0.6;

export function NativeActionSheet({
  input,
  onSelect,
  onCancel,
}: {
  input: SheetInput;
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <BottomSheet
      isPresented
      onDismiss={onCancel}
      shouldDismissOnBackPress
      containerColor={colors.background}
      contentPadding={0}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View style={styles.panel} accessibilityViewIsModal>
          <ScrollView nestedScrollEnabled style={{ maxHeight: height * LIST_MAX_RATIO }}>
            <Text accessible accessibilityRole="header" style={styles.title}>
              {input.title || '작업 선택'}
            </Text>
            <View style={styles.rows}>
              {input.actions.map((action) => (
                <SheetButton
                  key={action.id}
                  testID={`sheet-action-${action.id}`}
                  label={action.label}
                  destructive={action.destructive}
                  onPress={() => onSelect(action.id)}
                />
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <SheetButton testID="sheet-cancel" label="취소" onPress={onCancel} />
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

// testID 는 E2E(agent-device)가 네이티브 시트 버튼을 웹 요소와 구분해 찾는 데 쓴다.
function SheetButton({
  testID,
  label,
  destructive,
  onPress,
}: {
  testID: string;
  label: string;
  destructive?: boolean | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.background },
  title: { padding: space[16], color: colors.textStrong, ...typeScale.title1Bold },
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
