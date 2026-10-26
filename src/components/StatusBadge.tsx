// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Badge status sesi berwarna. Dipakai juga oleh layar lain, jadi props jangan diubah.
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_COLORS, STATUS_LABEL } from '../constants/colors';
import type { SessionStatus } from '../data/types';

type Props = {
  status: SessionStatus;
};

export default function StatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status];
  return (
    <View
      style={[styles.badge, { backgroundColor: color.bg }]}
      accessibilityLabel={`Status ${STATUS_LABEL[status]}`}
    >
      <View style={[styles.dot, { backgroundColor: color.text }]} />
      <Text style={[styles.text, { color: color.text }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
