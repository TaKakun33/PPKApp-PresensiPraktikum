import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, font } from '../constants/theme';

export default function LoadingState({ message = 'Memuat data...' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bg,
  },
  text: { marginTop: 12, fontSize: 13, fontFamily: font.medium, color: colors.textSecondary },
});
