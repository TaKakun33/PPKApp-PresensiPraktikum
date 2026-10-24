// STUB dari PM - pemilik: Damar (feat/student-checkin-history), SRS-07.
// TODO: daftar dari getHistory() (sesi, kelas, waktu hadir via formatTanggalJam),
//       empty state jika belum pernah presensi (coba login sebagai Budi / p2).
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function HistoryScreen() {
  const { currentUser, getHistory } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HistoryScreen (stub)</Text>
      <Text style={styles.text}>Login: {currentUser.name}</Text>
      <Text style={styles.text}>Jumlah riwayat: {getHistory().length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
