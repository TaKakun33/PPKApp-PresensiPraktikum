// STUB dari PM - pemilik: Damar (feat/student-checkin-history), SRS-05 dan SRS-06.
// TODO: daftar sesi + tombol presensi (aktif hanya saat Dibuka, nonaktif + alasan jika
//       Belum Dibuka / Ditutup), panggil checkIn(sessionId), tampilkan SuccessBottomSheet
//       jika result.ok, pesan jika gagal, dan label "Sudah hadir" memakai hasCheckedIn().
// Sesi s2 (Modul 2) sudah berstatus Dibuka di data dummy, jadi bisa langsung dites.
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function CheckInScreen() {
  const { currentUser } = useApp();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CheckInScreen (stub)</Text>
      <Text style={styles.text}>Login: {currentUser.nama}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  text: { fontSize: 14, color: COLORS.muted },
});
