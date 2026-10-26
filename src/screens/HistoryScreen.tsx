// STUB dari PM - pemilik: Damar (feat/student-checkin-history), SRS-07.
// Riwayat kehadiran praktikan (sesi, kelas, waktu hadir) + empty state.
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { formatTanggalJam } from '../utils/format';

export default function HistoryScreen() {
  const { currentUser, getHistory } = useApp();
  const history = getHistory();

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Belum ada riwayat</Text>
        <Text style={styles.text}>
          Halo {currentUser.nama}, presensi yang kamu lakukan akan muncul di sini.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={history}
      keyExtractor={(item) => item.attendance.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.session.praktikum}</Text>
          <Text style={styles.text}>Kelas: {item.session.kelas}</Text>
          <Text style={styles.text}>
            Waktu hadir: {formatTanggalJam(item.attendance.waktuHadir)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
  list: { backgroundColor: COLORS.background },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, gap: 4 },
});