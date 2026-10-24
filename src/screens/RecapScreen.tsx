// STUB dari PM - pemilik: Naufal (feat/assistant-session-recap), SRS-10.
// TODO: pilih sesi, tampilkan getRecap(sessionId) (nama, NIM, waktu) + jumlahnya.
//       Kosong -> EmptyState; sesi Belum Dibuka -> info "sesi belum dibuka".
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function RecapScreen() {
  const { currentUser } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RecapScreen (stub)</Text>
      <Text style={styles.text}>Login: {currentUser.nama}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
