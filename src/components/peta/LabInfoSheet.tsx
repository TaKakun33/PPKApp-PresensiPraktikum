// FILE AKMAL (feat/peta-lab) — SRS-31, SRS-32.
// Panel info lab yang muncul saat marker/chip lab dipilih: data lab + praktikum yang sedang
// berlangsung dan berikutnya (dari sesi Firestore, real-time).
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, text } from '../../constants/theme';
import type { Session } from '../../lib/types';
import type { LabPeta } from '../../services/labActivityService';
import { labelTanggal, labelWaktu } from '../../services/sessionService';
import type { AktivitasLab } from '../../utils/aktivitasLab';
import StatusBadge from '../StatusBadge';

type Props = {
  lab: LabPeta;
  /** null = data sesi belum termuat. */
  aktivitas: AktivitasLab | null;
  /** Pesan jika sesi gagal dimuat; peta dan data lab tetap tampil. */
  galatAktivitas: string | null;
  /** true = jadwal berasal dari cache lokal (offline), mungkin belum terbaru. */
  dataMungkinLama?: boolean;
  /** Nama kelas dari kelasId (hanya kelas yang bisa dibaca pengguna). */
  namaKelas: (kelasId: string) => string | undefined;
  onTutup: () => void;
  onCobaLagi: () => void;
};

function BarisSesi({ sesi, namaKelas }: { sesi: Session; namaKelas: Props['namaKelas'] }) {
  const kelas = namaKelas(sesi.kelasId) ?? 'Kelas lain';
  return (
    <View style={styles.sesi}>
      <View style={styles.sesiAtas}>
        <Text style={styles.sesiJudul} numberOfLines={2}>
          {sesi.praktikum}
        </Text>
        <StatusBadge status={sesi.status} />
      </View>
      <View style={styles.meta}>
        <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.metaTeks}>{kelas}</Text>
        <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} style={styles.metaIkon} />
        <Text style={styles.metaTeks}>{labelTanggal(sesi.tanggal)}</Text>
        <Ionicons name="time-outline" size={13} color={colors.textSecondary} style={styles.metaIkon} />
        <Text style={styles.metaTeks}>{labelWaktu(sesi)}</Text>
      </View>
    </View>
  );
}

function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <View style={styles.bagian}>
      <Text style={styles.bagianJudul}>{judul}</Text>
      {children}
    </View>
  );
}

export default function LabInfoSheet({ lab, aktivitas, galatAktivitas, dataMungkinLama = false, namaKelas, onTutup, onCobaLagi }: Props) {
  return (
    <View style={styles.sheet} accessibilityLabel={`Info ${lab.nama}`}>
      <View style={styles.kepala}>
        <View style={styles.kepalaTeks}>
          <Text style={styles.judul} numberOfLines={1}>
            {lab.nama}
          </Text>
          <Text style={styles.subjudul} numberOfLines={1}>
            {lab.kapasitas > 0 ? `Kapasitas ${lab.kapasitas} orang` : 'Kapasitas belum diatur'}
            {lab.radiusMeter ? ` · radius presensi ${lab.radiusMeter} m` : ''}
          </Text>
        </View>
        <Pressable
          onPress={onTutup}
          accessibilityRole="button"
          accessibilityLabel="Tutup info lab"
          hitSlop={10}
          style={({ pressed }) => [styles.tutup, pressed && styles.ditekan]}
        >
          <Ionicons name="close" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.isi} showsVerticalScrollIndicator={false}>
        {galatAktivitas ? (
          <View style={styles.galat}>
            <Text style={styles.galatTeks}>{galatAktivitas}</Text>
            <Pressable onPress={onCobaLagi} accessibilityRole="button" style={({ pressed }) => pressed && styles.ditekan}>
              <Text style={styles.galatAksi}>Coba lagi</Text>
            </Pressable>
          </View>
        ) : aktivitas === null ? (
          <Text style={styles.kosong}>Memuat aktivitas lab...</Text>
        ) : (
          <>
            {dataMungkinLama ? (
              <View style={styles.catatan}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
                <Text style={styles.catatanTeks}>Offline: jadwal mungkin belum terbaru.</Text>
              </View>
            ) : null}
            <Bagian judul="Sedang berlangsung">
              {aktivitas.berlangsung ? (
                <BarisSesi sesi={aktivitas.berlangsung} namaKelas={namaKelas} />
              ) : (
                <Text style={styles.kosong}>Tidak ada praktikum yang sedang berlangsung.</Text>
              )}
            </Bagian>
            <Bagian judul="Berikutnya">
              {aktivitas.berikutnya.length > 0 ? (
                aktivitas.berikutnya.map((s) => <BarisSesi key={s.id} sesi={s} namaKelas={namaKelas} />)
              ) : (
                <Text style={styles.kosong}>Belum ada jadwal praktikum berikutnya dalam 7 hari ke depan.</Text>
              )}
            </Bagian>
          </>
        )}
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
  bagian: { marginBottom: 12 },
  bagianJudul: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sesi: {
    padding: 12,
    borderRadius: radius.icon + 4,
    backgroundColor: colors.surface,
    marginBottom: 8,
    gap: 6,
  },
  sesiAtas: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  sesiJudul: { ...text.bodyStrong, flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  metaIkon: { marginLeft: 8 },
  metaTeks: { ...text.caption },
  kosong: { ...text.body },
  catatan: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  catatanTeks: { ...text.caption, color: colors.warning },
  galat: { gap: 6 },
  galatTeks: { ...text.body, color: colors.danger },
  galatAksi: { fontSize: 12, fontFamily: font.bold, color: colors.primary },
  ditekan: { opacity: 0.7 },
});
