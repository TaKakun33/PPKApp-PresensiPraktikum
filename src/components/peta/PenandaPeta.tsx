// FILE AKMAL (feat/peta-lab) — SRS-31. Ikon penanda di peta:
//   - PenandaLab      : ikon lokasi (pin) berwarna sesuai warna radius lab + kode lab di atasnya.
//   - PenandaPengguna : ikon orang (lingkaran biru) untuk posisi pengguna.
// Marker kustom di Android digambar sebagai gambar statis. `tracksViewChanges` hanya dinyalakan sebentar
// setelah tampilan berubah (warna / terpilih), lalu dimatikan supaya peta tetap ringan.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors, font } from '../../constants/theme';
import type { LabPeta } from '../../services/labActivityService';
import type { Koordinat } from '../../utils/aktivitasLab';

const LAMA_RENDER_MS = 800;

/** true hanya sebentar setelah salah satu nilai `kunci` berubah. */
function useLacakSebentar(kunci: string): boolean {
  const [lacak, setLacak] = useState(true);
  useEffect(() => {
    // Kunci berubah: gambar ulang dulu (lacak = true), lalu matikan lagi.
    const mulai = setTimeout(() => setLacak(true), 0);
    const selesai = setTimeout(() => setLacak(false), LAMA_RENDER_MS);
    return () => {
      clearTimeout(mulai);
      clearTimeout(selesai);
    };
  }, [kunci]);
  return lacak;
}

type PropsLab = {
  lab: LabPeta;
  /** Warna yang sama dengan lingkaran radius dan titik di chip lab. */
  warna: string;
  terpilih: boolean;
  onPress: () => void;
};

export function PenandaLab({ lab, warna, terpilih, onPress }: PropsLab) {
  const lacak = useLacakSebentar(`${warna}|${terpilih}|${lab.kode}`);
  if (!lab.koordinat) return null;
  const ukuran = terpilih ? 44 : 34;
  const kotak = ukuran + 6;
  return (
    <Marker
      identifier={lab.kode}
      coordinate={{ latitude: lab.koordinat.lat, longitude: lab.koordinat.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={lacak}
      zIndex={terpilih ? 5 : 1}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={styles.bungkusLab} collapsable={false}>
        <View style={[styles.label, { backgroundColor: warna }]}>
          <Text style={styles.labelTeks}>{lab.kode}</Text>
        </View>
        <View style={{ width: kotak, height: kotak, alignItems: 'center', justifyContent: 'center' }}>
          {/* Lapisan putih sedikit lebih besar di belakang = garis tepi ikon. */}
          <Ionicons name="location" size={kotak} color={colors.white} style={styles.menumpuk} />
          <Ionicons name="location" size={ukuran} color={warna} />
        </View>
      </View>
    </Marker>
  );
}

type PropsPengguna = {
  posisi: Koordinat;
  onPress: () => void;
};

export function PenandaPengguna({ posisi, onPress }: PropsPengguna) {
  const lacak = useLacakSebentar('pengguna');
  return (
    <Marker
      coordinate={{ latitude: posisi.lat, longitude: posisi.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={lacak}
      zIndex={10}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={styles.pengguna} collapsable={false}>
        <Ionicons name="person" size={18} color={colors.white} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bungkusLab: { alignItems: 'center', minWidth: 56 },
  label: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, marginBottom: 1 },
  labelTeks: { fontSize: 10, fontFamily: font.bold, color: colors.white },
  menumpuk: { position: 'absolute' },
  pengguna: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A73E8',
    borderWidth: 3,
    borderColor: colors.white,
  },
});
