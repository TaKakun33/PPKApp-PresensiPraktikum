// STUB dari PM - pemilik: Hadrian (feat/schedule-detail). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants/colors';
import type { Session } from '../data/types';
import StatusBadge from './StatusBadge';

type Props = {
  session: Session;
  onPress?: () => void;
};

export default function SessionCard({ session, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.title}>{session.praktikum}</Text>
      <Text style={styles.meta}>
        Kelas {session.kelas} - {session.tanggal}, {session.waktu}
      </Text>
      <StatusBadge status={session.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.muted },
});
