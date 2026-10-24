// STUB dari PM - pemilik: Hadrian (feat/schedule-detail). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';

type Props = {
  title: string;
  message?: string;
};

export default function EmptyState({ title, message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  message: { marginTop: 6, fontSize: 14, color: COLORS.muted, textAlign: 'center' },
});
