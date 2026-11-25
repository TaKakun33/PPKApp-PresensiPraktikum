// FILE AKMAL (feat/peta-lab) — SRS-31. Panel yang muncul saat ikon posisi pengguna diketuk:
// jarak (garis lurus) dari posisi pengguna ke setiap lab, terdekat lebih dulu. Ikut berubah saat pengguna bergerak.
// Hanya informasi; validasi radius presensi yang sebenarnya ada di fitur presensi.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, text } from '../../constants/theme';
import { labelJarak } from '../../utils/aktivitasLab';

export type JarakKeLab = {
  kode: string;
  nama: string;
  warna: string;
  jarak: number;
  /** true/false jika radius lab diketahui; null jika belum diatur. */
  dalamRadius: boolean | null;
};

type Props = {
  akurasiMeter: number | null;
  daftar: JarakKeLab[];
  onTutup: () => void;
};

export default function PosisiInfoSheet({ akurasiMeter, daftar, onTutup }: Props) {
  return (
    <View style={styles.sheet} accessibilityLabel="Jarak ke setiap lab">
      <View style={styles.kepala}>
        <View style={styles.ikon}>
          <Ionicons name="person" size={16} color={colors.white} />
        </View>
        <View style={styles.kepalaTeks}>
          <Text style={styles.judul} numberOfLines={1}>
            Posisimu
          </Text>
          <Text style={styles.subjudul} numberOfLines={1}>
            Jarak ke setiap lab{akurasiMeter !== null ? ` · akurasi ±${Math.round(akurasiMeter)} m` : ''}
          </Text>
        </View>
        <Pressable
          onPress={onTutup}
          accessibilityRole="button"
          accessibilityLabel="Tutup info posisi"
          hitSlop={10}
          style={({ pressed }) => [styles.tutup, pressed && styles.ditekan]}
        >
          <Ionicons name="close" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.isi} showsVerticalScrollIndicator={false}>
        {daftar.length === 0 ? (
          <Text style={styles.kosong}>Belum ada lab dengan koordinat, jadi jarak belum bisa dihitung.</Text>
        ) : (
          daftar.map((d) => (
            <View key={d.kode} style={styles.baris}>
              <View style={[styles.titik, { backgroundColor: d.warna }]} />
              <View style={styles.barisTeks}>
                <Text style={styles.nama} numberOfLines={1}>
                  {d.nama}
                </Text>
                {d.dalamRadius ? <Text style={styles.dalam}>Di dalam radius presensi</Text> : null}
              </View>
              <Text style={styles.jarak}>{labelJarak(d.jarak)}</Text>
            </View>
          ))
        )}
        <Text style={styles.catatan}>Jarak garis lurus, perkiraan sesuai akurasi GPS.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: 320,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadow.floating,
  },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ikon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A73E8',
  },
  kepalaTeks: { flex: 1 },
  judul: { ...text.sectionTitle },
  subjudul: { ...text.caption, marginTop: 2 },
  tutup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  isi: { marginTop: 10 },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.icon + 4,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  titik: { width: 10, height: 10, borderRadius: 5 },
  barisTeks: { flex: 1 },
  nama: { ...text.bodyStrong },
  dalam: { fontSize: 11, fontFamily: font.semibold, color: colors.success, marginTop: 1 },
  jarak: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  kosong: { ...text.body },
  catatan: { ...text.caption, marginTop: 2, marginBottom: 4 },
  ditekan: { opacity: 0.7 },
});
