// STUB dari PM - pemilik: Hadrian (feat/schedule-detail). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_COLORS } from '../constants/colors';
import type { SessionStatus } from '../data/types';

type Props = {
  status: SessionStatus;
};

export default function StatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.text, { color: color.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: '600' },
});
