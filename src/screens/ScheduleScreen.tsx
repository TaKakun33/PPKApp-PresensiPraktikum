// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Daftar jadwal sesi milik pengguna aktif. Layar ini dipakai oleh DUA peran (praktikan dan asisten).
// Sesi dibaca langsung dari store, jadi status yang diubah asisten ikut berubah di sini.
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import SessionCard from '../components/SessionCard';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

export default function ScheduleScreen() {
  const { currentUser, getVisibleSessions } = useApp();
  const sessions = getVisibleSessions();
  const isAsisten = currentUser.role === 'asisten';

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.login} numberOfLines={1}>
            Login: {currentUser.nama} ({isAsisten ? 'Asisten' : 'Praktikan'})
          </Text>
          <Text style={styles.title}>{isAsisten ? 'Sesi yang Kamu Ampu' : 'Jadwal Praktikum'}</Text>
          <Text style={styles.subtitle}>
            {sessions.length > 0
              ? `${sessions.length} sesi. Tekan kartu untuk melihat detail.`
              : 'Belum ada sesi.'}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="Belum ada jadwal"
          message={
            isAsisten
              ? 'Kamu belum mengampu sesi praktikum apa pun.'
              : 'Belum ada sesi praktikum untuk kelasmu.'
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.background },
  // flexGrow supaya EmptyState (flex: 1) bisa mengisi sisa layar.
  content: { flexGrow: 1, padding: 20 },
  header: { gap: 4, marginBottom: 16 },
  login: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  separator: { height: 12 },
});
