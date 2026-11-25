// FILE AKMAL (feat/peta-lab) — SRS-33.
// Banner info di atas peta untuk kondisi perangkat/data (izin ditolak, GPS mati, offline, dst.).
// Peta tetap tampil di bawahnya; banner hanya menjelaskan apa yang sedang terjadi dan apa yang bisa dilakukan.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, status as statusToken } from '../../constants/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type NadaBanner = 'info' | 'peringatan' | 'bahaya';

type Props = {
  pesan: string;
  nada?: NadaBanner;
  icon?: IoniconsName;
  memuat?: boolean;
  aksi?: { label: string; onPress: () => void };
};

const WARNA: Record<NadaBanner, { bg: string; fg: string }> = {
  info: { bg: colors.tint, fg: colors.primary },
  peringatan: { bg: statusToken.warning.bg, fg: statusToken.warning.text },
  bahaya: { bg: statusToken.danger.bg, fg: statusToken.danger.text },
};

export default function KondisiBanner({ pesan, nada = 'info', icon = 'information-circle-outline', memuat = false, aksi }: Props) {
  const warna = WARNA[nada];
  return (
    <View
      style={[styles.banner, { backgroundColor: warna.bg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {memuat ? (
        <ActivityIndicator size="small" color={warna.fg} />
      ) : (
        <Ionicons name={icon} size={18} color={warna.fg} />
      )}
      <Text style={[styles.pesan, { color: warna.fg }]}>{pesan}</Text>
      {aksi ? (
        <Pressable
          onPress={aksi.onPress}
          accessibilityRole="button"
          accessibilityLabel={aksi.label}
          style={({ pressed }) => [styles.aksi, { borderColor: warna.fg }, pressed && styles.ditekan]}
          hitSlop={6}
        >
          <Text style={[styles.aksiTeks, { color: warna.fg }]}>{aksi.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.icon + 4,
  },
  pesan: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: font.semibold },
  aksi: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  aksiTeks: { fontSize: 11, fontFamily: font.bold },
  ditekan: { opacity: 0.7 },
});
