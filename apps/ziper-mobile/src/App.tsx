import { Host, Text } from '@expo/ui';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function App() {
  return (
    <View style={styles.container}>
      <Host matchContents>
        <Text>Ziper</Text>
      </Host>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
