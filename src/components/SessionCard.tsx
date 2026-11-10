// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Kartu satu sesi di daftar jadwal. Props dipertahankan agar layar lain tidak rusak.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import type { Session } from '../data/types';
import StatusBadge from './StatusBadge';

type Props = {
  session: Session;
  onPress?: () => void;
};

export default function SessionCard({ session, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.praktikum}, kelas ${session.kelas}, ${session.tanggal} ${session.waktu}`}
    >
      <View style={styles.topRow}>
        <StatusBadge status={session.status} />
        {onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.mutedLight} /> : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {session.praktikum}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>Kelas {session.kelas}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>{session.tanggal}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>{session.waktu}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  cardPressed: { backgroundColor: COLORS.surface },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
});
