// STUB dari PM - pemilik: Naufal (feat/assistant-session-recap), SRS-08 dan SRS-09.
// TODO: daftar sesi milik asisten (getVisibleSessions), tombol aksi sesuai status:
//       Belum Dibuka -> "Buka sesi", Dibuka -> "Tutup sesi", Ditutup -> tanpa tombol.
//       Tombol memunculkan ConfirmModal, lalu panggil openSession / closeSession,
//       dan tampilkan umpan balik berhasil (result.message).
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function ManageSessionScreen() {
  const { currentUser } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ManageSessionScreen (stub)</Text>
      <Text style={styles.text}>Login: {currentUser.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
