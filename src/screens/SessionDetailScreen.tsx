// Pemilik: Hadrian (feat/schedule-detail), SRS-04.
// Detail satu sesi: praktikum, kelas, tanggal, waktu, ruangan, asisten, dan status.
// Id sesi diambil dari URL: /session/s2. Id yang tidak ada (mis. /session/s99) menampilkan EmptyState.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function InfoRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getSessionById } = useApp();
  const session = getSessionById(id);

  if (!session) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Sesi tidak ditemukan"
          message={`Sesi dengan ID "${id ?? '-'}" tidak ada atau sudah dihapus.`}
        />
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <StatusBadge status={session.status} />
        <Text style={styles.title}>{session.praktikum}</Text>
        <Text style={styles.subtitle}>{session.judulModul}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="book-outline" label="Praktikum" value={session.praktikum} />
        <InfoRow icon="people-outline" label="Kelas" value={`Kelas ${session.kelas}`} />
        <InfoRow icon="calendar-outline" label="Tanggal" value={session.tanggal} />
        <InfoRow icon="time-outline" label="Waktu" value={`${session.waktu} WIB`} />
        <InfoRow icon="location-outline" label="Ruangan" value={session.ruangan} />
        <InfoRow icon="person-outline" label="Asisten" value={session.asistenNama} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16 },
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 8,
  },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  rowValue: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  notFound: { flex: 1, padding: 24, backgroundColor: COLORS.background },
  backButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.text,
  },
  backButtonPressed: { opacity: 0.85 },
  backButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
