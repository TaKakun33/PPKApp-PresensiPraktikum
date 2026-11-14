// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Badge status sesi berwarna. Dipakai juga oleh layar lain, jadi props jangan diubah.
import { StyleSheet, Text, View } from 'react-native';

import type { SessionStatus } from '../data/types';
import type { StatusIzin } from '../lib/constants';
import { colors, font, radius, status as statusTokens } from '../constants/theme';

type BadgeStatus = SessionStatus | StatusIzin | 'hadir' | 'terlambat';

const BADGE: Record<BadgeStatus, { label: string; bg: string; text: string }> = {
  belum_dibuka: { label: 'Belum Dibuka', bg: colors.surface, text: colors.textSecondary },
  dibuka: { label: 'Dibuka', bg: colors.tint, text: colors.primary },
  ditutup: { label: 'Ditutup', bg: colors.surface, text: colors.textSecondary },
  hadir: { label: 'Hadir', ...statusTokens.success },
  terlambat: { label: 'Terlambat', ...statusTokens.warning },
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
      style={[styles.badge, { backgroundColor: badge.bg }]}
      accessibilityLabel={`Status ${badge.label}`}
    >
      <View style={[styles.dot, { backgroundColor: badge.text }]} />
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
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontFamily: font.semibold },
});
