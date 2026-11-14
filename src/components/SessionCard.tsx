// Pemilik: Hadrian (feat/classsessioncrud), SRS-17.
// Kartu satu sesi di daftar jadwal. Props session dan onPress dipertahankan agar layar lain tidak rusak;
// kelasNama opsional (nama kelas dari koleksi classes, fallback ke kelasId).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Session } from '../lib/types';
import { COLORS } from '../constants/colors';
import { labelTanggal, labelWaktu } from '../services/sessionService';
import StatusBadge from './StatusBadge';

type Props = {
  session: Session;
  onPress?: () => void;
  kelasNama?: string;
};

export default function SessionCard({ session, onPress, kelasNama }: Props) {
  const kelas = kelasNama ?? session.kelasId;
  const tanggal = labelTanggal(session.tanggal);
  const waktu = labelWaktu(session);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.praktikum}, ${kelas}, ${tanggal} ${waktu}`}
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
          <Text style={styles.metaText}>{kelas}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>{tanggal}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>{waktu}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={COLORS.muted} />
          <Text style={styles.metaText}>{session.ruangan}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  cardPressed: { backgroundColor: COLORS.surface, opacity: 0.88 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
});
