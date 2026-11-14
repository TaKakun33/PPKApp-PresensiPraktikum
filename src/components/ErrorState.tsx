import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, text } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

type Props = { message?: string; onRetry?: () => void };

export default function ErrorState({
  message = 'Terjadi kesalahan. Periksa koneksi internet.',
  onRetry,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name="alert-circle-outline" size={30} color={colors.danger} />
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <PrimaryButton
          label="Coba lagi"
          onPress={onRetry}
          variant="secondary"
          style={styles.retry}
        />
      ) : null}
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
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerTint,
    marginBottom: 14,
  },
  message: { ...text.body, maxWidth: 300, textAlign: 'center' },
  retry: { marginTop: 18, minWidth: 160, minHeight: 46, alignSelf: 'center' },
});
