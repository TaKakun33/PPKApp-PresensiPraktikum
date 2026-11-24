// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Badge status sesi berwarna. Dipakai juga oleh layar lain, jadi props jangan diubah.
import { StyleSheet, Text, View } from 'react-native';

import type { StatusIzin, StatusSesi } from '../lib/constants';
import { colors, font, radius, status as statusTokens } from '../constants/theme';

type BadgeStatus = StatusSesi | StatusIzin | 'hadir';

const BADGE: Record<BadgeStatus, { label: string; bg: string; text: string }> = {
  // Tiga status sesi dibedakan warna DAN bentuk: belum dibuka bergaris tepi,
  // dibuka memakai aksen, ditutup abu tanpa titik.
  belum_dibuka: { label: 'Belum Dibuka', ...statusTokens.info },
  dibuka: { label: 'Dibuka', ...statusTokens.active },
  ditutup: { label: 'Ditutup', ...statusTokens.neutral },
  hadir: { label: 'Hadir', ...statusTokens.success },
  menunggu: { label: 'Menunggu', ...statusTokens.warning },
  diterima: { label: 'Diterima', ...statusTokens.success },
  ditolak: { label: 'Ditolak', ...statusTokens.danger },
};

type Props = {
  status: BadgeStatus;
};

export default function StatusBadge({ status }: Props) {
  const badge = BADGE[status] ?? BADGE.belum_dibuka;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badge.bg },
        status === 'belum_dibuka' && styles.outlined,
        status === 'ditutup' && styles.closed,
      ]}
      accessibilityLabel={`Status ${badge.label}`}
    >
      {status === 'ditutup' ? null : <View style={[styles.dot, { backgroundColor: badge.text }]} />}
      <Text style={[styles.text, { color: badge.text }]}>{badge.label}</Text>
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
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  outlined: { borderWidth: 1, borderColor: colors.dashed },
  closed: { borderWidth: 1, borderColor: colors.border },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontFamily: font.semibold },
});
