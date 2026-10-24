// STUB dari PM - pemilik: Hadrian (feat/schedule-detail), SRS-03.
// TODO: FlatList SessionCard dari getVisibleSessions(), tekan kartu -> router.push(`/session/${id}`),
//       empty state jika daftar kosong (coba login sebagai Kak Sinta / praktikan kelas B).
// Layar ini dipakai oleh DUA peran (praktikan dan asisten).
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function ScheduleScreen() {
  const { currentUser, getVisibleSessions } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ScheduleScreen (stub)</Text>
      <Text style={styles.text}>Login: {currentUser.name} ({currentUser.role})</Text>
      <Text style={styles.text}>Jumlah sesi terlihat: {getVisibleSessions().length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
