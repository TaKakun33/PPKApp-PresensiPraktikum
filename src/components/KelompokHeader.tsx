// Judul kelompok sesi (judul + jumlah + keterangan) untuk daftar berkelompok di layar Jadwal dan Kelola Sesi.
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, text } from '../constants/theme';

type Props = { judul: string; keterangan: string; jumlah: number };

export default function KelompokHeader({ judul, keterangan, jumlah }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={styles.baris}>
        <Text style={styles.judul}>{judul}</Text>
        <View style={styles.jumlah}>
          <Text style={styles.jumlahTeks}>{jumlah}</Text>
        </View>
      </View>
      <Text style={styles.keterangan}>{keterangan}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, marginTop: 14, marginBottom: 10 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  judul: { ...text.sectionTitle },
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
});
