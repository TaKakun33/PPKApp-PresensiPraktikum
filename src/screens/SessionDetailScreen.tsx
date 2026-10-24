// STUB dari PM - pemilik: Hadrian (feat/schedule-detail), SRS-04.
// TODO: tampilkan praktikum, kelas, tanggal, waktu, ruangan, asisten, dan status (StatusBadge).
// Id sesi diambil dari URL: /session/s2
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getSessionById } = useApp();
  const session = getSessionById(id);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SessionDetailScreen (stub)</Text>
      <Text style={styles.text}>{session ? session.praktikum : 'Sesi tidak ditemukan'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
