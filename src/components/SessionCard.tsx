// Pemilik: Hadrian (feat/classsessioncrud), SRS-17.
// Kartu satu sesi di daftar jadwal. Props session dan onPress dipertahankan agar layar lain tidak rusak;
// kelasNama opsional (nama kelas dari koleksi classes, fallback ke kelasId).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Session } from '../lib/types';
import { colors, font, radius, text } from '../constants/theme';
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
        {onPress ? (
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {session.praktikum}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{tanggal}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{waktu}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{kelas}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{session.ruangan}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardPressed: { backgroundColor: colors.surface, opacity: 0.9 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  title: { fontSize: 15, lineHeight: 21, fontFamily: font.bold, color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { ...text.caption, color: colors.textSecondary },
});
