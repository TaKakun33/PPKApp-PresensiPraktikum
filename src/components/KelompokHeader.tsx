// Judul kelompok sesi (judul + jumlah + keterangan) untuk daftar berkelompok di layar Jadwal dan Kelola Sesi.
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, text } from '../constants/theme';

type Props = { judul: string; keterangan: string; jumlah: number; compact?: boolean };

export default function KelompokHeader({ judul, keterangan, jumlah, compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityRole="header">
      <View style={styles.baris}>
        <Text style={[styles.judul, compact && styles.judulCompact]}>{judul}</Text>
        <View style={styles.jumlah}>
          <Text style={styles.jumlahTeks}>{jumlah}</Text>
        </View>
      </View>
      <Text style={[styles.keterangan, compact && styles.keteranganCompact]}>{keterangan}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, marginTop: 14, marginBottom: 10 },
  wrapCompact: { gap: 1, marginTop: 2, marginBottom: 6 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  judul: { ...text.sectionTitle },
  judulCompact: { fontSize: 14.5 },
  jumlah: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.tint,
  },
  jumlahTeks: { fontSize: 11, fontFamily: font.bold, color: colors.secondaryText },
  keterangan: { ...text.caption },
  keteranganCompact: { fontSize: 11.5, lineHeight: 15 },
});
