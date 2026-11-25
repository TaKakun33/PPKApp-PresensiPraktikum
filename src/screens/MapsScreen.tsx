// FILE AKMAL (feat/peta-lab) — SRS-31, SRS-32, SRS-33.
// Tab Peta untuk praktikan DAN asisten (route tipis di app/praktikan/peta.tsx & app/asisten/peta.tsx).
//   SRS-31: marker semua lab Informatika + marker posisi pengguna yang mengikuti perangkat;
//           marker/chip lab bisa dipilih untuk melihat info lab.
//   SRS-32: info lab menampilkan praktikum yang sedang berlangsung dan berikutnya (sesi Firestore, real-time).
//   SRS-33: izin lokasi ditolak / GPS mati / lokasi belum tersedia / offline / data kosong ditangani:
//           peta SELALU tampil, hanya marker pengguna yang hilang, disertai banner penjelasan.
// Listener Firestore dan pelacakan GPS hanya aktif selama tab ini terlihat (hemat baterai & biaya baca).
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import KondisiBanner from '../components/peta/KondisiBanner';
import LabInfoSheet from '../components/peta/LabInfoSheet';
import ScreenHeader from '../components/ScreenHeader';
import { colors, font, layout, radius, shadow } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { usePosisiPengguna } from '../hooks/usePosisiPengguna';
import type { Session } from '../lib/types';
import { labelKelas, pesanFirestore, subscribeClassesForUser } from '../services/classService';
import {
  subscribeLabPeta,
  subscribeSesiRentang,
  type LabPeta,
} from '../services/labActivityService';
import {
  JENDELA_HARI,
  hitungAktivitasLab,
  tambahHari,
  tanggalWibDari,
  wilayahDariKoordinat,
  wilayahSekitar,
  type Wilayah,
} from '../utils/aktivitasLab';

/** Batas menunggu data pertama dari server saat belum ada cache (offline total tidak memicu error Firestore). */
const BATAS_MUAT_MS = 12000;
/** Seberapa sering "sekarang" dihitung ulang agar status berlangsung/berikutnya ikut berubah sendiri. */
const DETAK_MS = 30000;

// Warna marker SELALU diberikan eksplisit. Jangan kirim `pinColor={undefined}`: di arsitektur baru (Fabric)
// react-native-maps menerjemahkannya jadi null dan aplikasi crash (NullPointerException di setPinColor).
const WARNA_MARKER_LAB = '#D93025';
const WARNA_MARKER_TERPILIH = colors.primary;
const WARNA_MARKER_PENGGUNA = '#1A73E8';
// Warna area radius per lab (urut sesuai daftar lab). Lab Informatika berdekatan, jadi warna berbeda
// membantu membedakan lingkaran yang saling tumpang tindih. Chip lab memakai warna yang sama.
const PALET_LAB = ['#1A73E8', '#188038', '#E37400', '#9334E6', '#C5221F', '#00838F'] as const;

// Dipakai hanya selama belum ada lab berkoordinat dan posisi pengguna belum diketahui (satu Indonesia).
const WILAYAH_AWAL: Wilayah = { latitude: -2.5, longitude: 118, latitudeDelta: 30, longitudeDelta: 30 };

function bukaPengaturanGps() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
  } else {
    Linking.openSettings().catch(() => {});
  }
}

export default function MapsScreen() {
  const { profile } = useAuth();
  const peta = useRef<MapView>(null);
  const [petaSiap, setPetaSiap] = useState(false);

  // Layar terlihat (tab aktif): listener & GPS hanya berjalan saat true.
  const [fokus, setFokus] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFokus(true);
      return () => setFokus(false);
    }, []),
  );

  const { status: lokasi, mintaIzin, cobaLagi: periksaUlangLokasi } = usePosisiPengguna(fokus);

  // ─── Lab ────────────────────────────────────────────────────────────────────
  const [labs, setLabs] = useState<LabPeta[] | null>(null);
  const [labDariCache, setLabDariCache] = useState(false);
  const [galatLab, setGalatLab] = useState<string | null>(null);
  const [muatLab, setMuatLab] = useState(0);
  const dataLabDiterima = useRef(false);

  useEffect(() => {
    if (!fokus) return;
    dataLabDiterima.current = false;
    // Offline tanpa cache: Firestore tidak melempar error, snapshot pertama hanya tidak pernah datang.
    const batas = setTimeout(() => {
      if (!dataLabDiterima.current) setGalatLab('Koneksi bermasalah. Data lab belum bisa dimuat.');
    }, BATAS_MUAT_MS);
    const berhenti = subscribeLabPeta(
      (data, meta) => {
        dataLabDiterima.current = true;
        clearTimeout(batas);
        setLabs(data);
        setLabDariCache(meta.dariCache);
        setGalatLab(null);
      },
      (e) => {
        clearTimeout(batas);
        setGalatLab(pesanFirestore(e, 'Gagal memuat data lab. Coba lagi.'));
      },
    );
    return () => {
      clearTimeout(batas);
      berhenti();
    };
  }, [fokus, muatLab]);

  // ─── Sesi (aktivitas lab) ───────────────────────────────────────────────────
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [sesi, setSesi] = useState<Session[] | null>(null);
  const [galatSesi, setGalatSesi] = useState<string | null>(null);
  const [muatSesi, setMuatSesi] = useState(0);
  const [sesiDariCache, setSesiDariCache] = useState(false);
  const dataSesiDiterima = useRef(false);
  // Diturunkan dari `sekarang` (ikut berganti oleh detak 30 dtk), jadi lewat tengah malam WIB rentang ikut bergeser.
  const hariIni = tanggalWibDari(sekarang);

  useEffect(() => {
    if (!fokus) return;
    const timer = setInterval(() => setSekarang(Date.now()), DETAK_MS);
    return () => clearInterval(timer);
  }, [fokus]);

  useEffect(() => {
    if (!fokus) return;
    dataSesiDiterima.current = false;
    // Offline tanpa cache: snapshot pertama tidak pernah datang dan tidak ada error, jadi beri batas waktu.
    const batas = setTimeout(() => {
      if (!dataSesiDiterima.current) setGalatSesi('Koneksi bermasalah. Aktivitas lab belum bisa dimuat.');
    }, BATAS_MUAT_MS);
    // Berganti hari (lewat tengah malam WIB) mengubah `hariIni` sehingga rentang query ikut bergeser.
    const berhenti = subscribeSesiRentang(
      hariIni,
      tambahHari(hariIni, JENDELA_HARI - 1),
      (data, meta) => {
        dataSesiDiterima.current = true;
        clearTimeout(batas);
        setSesi(data);
        setSesiDariCache(meta.dariCache);
        setGalatSesi(null);
      },
      (e) => {
        clearTimeout(batas);
        setGalatSesi(pesanFirestore(e, 'Aktivitas lab belum bisa dimuat. Coba lagi.'));
      },
    );
    return () => {
      clearTimeout(batas);
      berhenti();
    };
  }, [fokus, hariIni, muatSesi]);

  // Nama kelas hanya pelengkap; kelas yang tidak bisa dibaca pengguna ditampilkan sebagai "Kelas lain".
  const [kelasNama, setKelasNama] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!fokus || !profile) return;
    return subscribeClassesForUser(
      profile,
      (data) => setKelasNama(Object.fromEntries(data.map((c) => [c.id, labelKelas(c)]))),
      () => setKelasNama({}),
    );
  }, [fokus, profile]);

  // ─── Pilihan & tampilan peta ────────────────────────────────────────────────
  const [kodeTerpilih, setKodeTerpilih] = useState<string | null>(null);
  const labBerkoordinat = useMemo(() => (labs ?? []).filter((l) => l.koordinat), [labs]);
  const warnaLab = useMemo(
    () => Object.fromEntries((labs ?? []).map((l, i) => [l.kode, PALET_LAB[i % PALET_LAB.length]])) as Record<string, string>,
    [labs],
  );
  // Lab terpilih digambar paling akhir supaya lingkarannya berada di atas lingkaran lain.
  const labUntukLingkaran = useMemo(
    () => [...labBerkoordinat.filter((l) => l.kode !== kodeTerpilih), ...labBerkoordinat.filter((l) => l.kode === kodeTerpilih)],
    [labBerkoordinat, kodeTerpilih],
  );
  const terpilih = useMemo(() => (labs ?? []).find((l) => l.kode === kodeTerpilih) ?? null, [labs, kodeTerpilih]);
  const aktivitas = useMemo(
    () => (terpilih && sesi ? hitungAktivitasLab(sesi, terpilih, sekarang) : null),
    [terpilih, sesi, sekarang],
  );

  const wilayahSemuaLab = useMemo(
    () => wilayahDariKoordinat(labBerkoordinat.flatMap((l) => (l.koordinat ? [l.koordinat] : []))),
    [labBerkoordinat],
  );

  // Arahkan kamera ke semua lab begitu data lab pertama kali tersedia (dan saat daftar koordinat berubah).
  const kunciLab = labBerkoordinat.map((l) => `${l.kode}:${l.koordinat?.lat},${l.koordinat?.lng}`).join('|');
  useEffect(() => {
    if (petaSiap && wilayahSemuaLab) peta.current?.animateToRegion(wilayahSemuaLab, 400);
    // Hanya saat koordinat lab berubah (atau peta baru siap), bukan tiap snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciLab, petaSiap]);

  const pilihLab = useCallback((lab: LabPeta) => {
    setKodeTerpilih(lab.kode);
    if (lab.koordinat) peta.current?.animateToRegion(wilayahSekitar(lab.koordinat), 350);
  }, []);

  const tampilkanSemua = () => {
    setKodeTerpilih(null);
    if (wilayahSemuaLab) peta.current?.animateToRegion(wilayahSemuaLab, 350);
  };

  const posisi = lokasi.jenis === 'siap' ? lokasi.posisi : null;
  const pusatkanKeSaya = () => {
    if (posisi) peta.current?.animateToRegion(wilayahSekitar(posisi), 350);
  };

  // ─── Banner kondisi (SRS-33) ────────────────────────────────────────────────
  let bannerLokasi: ReactElement | null = null;
  switch (lokasi.jenis) {
    case 'izin_ditolak':
      bannerLokasi = (
        <KondisiBanner
          nada="peringatan"
          icon="location-outline"
          pesan="Izin lokasi ditolak, jadi posisimu tidak tampil. Peta lab tetap bisa dipakai."
          aksi={
            lokasi.bisaMinta
              ? { label: 'Izinkan', onPress: () => void mintaIzin() }
              : { label: 'Pengaturan', onPress: () => Linking.openSettings().catch(() => {}) }
          }
        />
      );
      break;
    case 'gps_mati':
      bannerLokasi = (
        <KondisiBanner
          nada="peringatan"
          icon="navigate-outline"
          pesan="GPS mati, jadi posisimu tidak tampil. Aktifkan GPS untuk melihat posisimu."
          aksi={{ label: 'Aktifkan', onPress: bukaPengaturanGps }}
        />
      );
      break;
    case 'error':
      bannerLokasi = (
        <KondisiBanner
          nada="peringatan"
          icon="alert-circle-outline"
          pesan={lokasi.pesan}
          aksi={{ label: 'Coba lagi', onPress: () => void periksaUlangLokasi() }}
        />
      );
      break;
    case 'tidak_didapat':
      bannerLokasi = (
        <KondisiBanner
          nada="peringatan"
          icon="locate-outline"
          pesan="Lokasimu belum didapat, jadi posisimu belum tampil. Coba pindah ke tempat terbuka."
          aksi={{ label: 'Coba lagi', onPress: () => void periksaUlangLokasi() }}
        />
      );
      break;
    case 'memeriksa':
    case 'mencari':
      bannerLokasi = <KondisiBanner memuat pesan="Mencari lokasimu..." />;
      break;
    default:
      bannerLokasi = null;
  }

  const bannerData = galatLab ? (
    <KondisiBanner
      nada="bahaya"
      icon="cloud-offline-outline"
      pesan={galatLab}
      aksi={{
        label: 'Coba lagi',
        onPress: () => {
          setGalatLab(null);
          setLabs(null);
          setMuatLab((k) => k + 1);
        },
      }}
    />
  ) : labs === null ? (
    <KondisiBanner memuat pesan="Memuat data lab..." />
  ) : labDariCache ? (
    <KondisiBanner nada="peringatan" icon="cloud-offline-outline" pesan="Tidak terhubung ke server. Menampilkan data lab yang tersimpan." />
  ) : labs.length === 0 ? (
    <KondisiBanner icon="map-outline" pesan="Belum ada data lab. Hubungi asisten untuk mengatur lokasi lab." />
  ) : labBerkoordinat.length === 0 ? (
    <KondisiBanner icon="map-outline" pesan="Koordinat lab belum diatur, jadi marker lab belum bisa ditampilkan." />
  ) : null;

  return (
    <View style={styles.layar}>
      <ScreenHeader title="Peta Lab" />
      <View style={styles.areaPeta}>
        <MapView
          ref={peta}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={wilayahSemuaLab ?? WILAYAH_AWAL}
          toolbarEnabled={false}
          rotateEnabled={false}
          onMapReady={() => setPetaSiap(true)}
          onPress={() => setKodeTerpilih(null)}
          accessibilityLabel="Peta lab Informatika"
        >
          {labBerkoordinat.map((lab) =>
            lab.koordinat ? (
              <Marker
                key={lab.kode}
                identifier={lab.kode}
                coordinate={{ latitude: lab.koordinat.lat, longitude: lab.koordinat.lng }}
                title={lab.nama}
                pinColor={lab.kode === kodeTerpilih ? WARNA_MARKER_TERPILIH : WARNA_MARKER_LAB}
                onPress={(e) => {
                  e.stopPropagation();
                  pilihLab(lab);
                }}
              />
            ) : null,
          )}
          {labUntukLingkaran.map((lab) =>
            lab.koordinat && lab.radiusMeter ? (
              <Circle
                key={`radius-${lab.kode}`}
                center={{ latitude: lab.koordinat.lat, longitude: lab.koordinat.lng }}
                radius={lab.radiusMeter}
                strokeColor={warnaLab[lab.kode]}
                fillColor={`${warnaLab[lab.kode]}${lab.kode === kodeTerpilih ? '40' : '1F'}`}
                strokeWidth={lab.kode === kodeTerpilih ? 3 : 1.5}
              />
            ) : null,
          )}
          {posisi ? (
            <Marker
              coordinate={{ latitude: posisi.lat, longitude: posisi.lng }}
              title="Posisimu"
              pinColor={WARNA_MARKER_PENGGUNA}
              zIndex={10}
            />
          ) : null}
        </MapView>

        <View style={styles.atas} pointerEvents="box-none">
          {bannerLokasi}
          {bannerData}
          {(labs ?? []).length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipBaris}
              keyboardShouldPersistTaps="handled"
            >
              {(labs ?? []).map((lab) => {
                const aktif = lab.kode === kodeTerpilih;
                return (
                  <Pressable
                    key={lab.kode}
                    onPress={() => pilihLab(lab)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktif }}
                    accessibilityLabel={lab.nama}
                    style={({ pressed }) => [styles.chip, aktif && styles.chipAktif, pressed && styles.ditekan]}
                  >
                    <View style={[styles.chipTitik, { backgroundColor: warnaLab[lab.kode] }]} />
                    <Text style={[styles.chipTeks, aktif && styles.chipTeksAktif]}>{lab.nama}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.bawah} pointerEvents="box-none">
          <View style={styles.tombolKanan} pointerEvents="box-none">
            {wilayahSemuaLab ? (
              <Pressable
                onPress={tampilkanSemua}
                accessibilityRole="button"
                accessibilityLabel="Tampilkan semua lab"
                style={({ pressed }) => [styles.fab, pressed && styles.ditekan]}
              >
                <Ionicons name="scan-outline" size={20} color={colors.primary} />
              </Pressable>
            ) : null}
            {posisi ? (
              <Pressable
                onPress={pusatkanKeSaya}
                accessibilityRole="button"
                accessibilityLabel="Pusatkan peta ke posisiku"
                style={({ pressed }) => [styles.fab, pressed && styles.ditekan]}
              >
                <Ionicons name="locate-outline" size={20} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          {terpilih ? (
            <LabInfoSheet
              lab={terpilih}
              aktivitas={aktivitas}
              galatAktivitas={galatSesi}
              dataMungkinLama={sesiDariCache}
              namaKelas={(kelasId) => kelasNama[kelasId]}
              onTutup={() => setKodeTerpilih(null)}
              onCobaLagi={() => {
                setGalatSesi(null);
                setSesi(null);
                setMuatSesi((k) => k + 1);
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layar: { flex: 1, backgroundColor: colors.bg },
  areaPeta: { flex: 1, overflow: 'hidden' },
  atas: { position: 'absolute', top: 8, left: 12, right: 12, gap: 8 },
  chipBaris: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipAktif: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTitik: { width: 9, height: 9, borderRadius: 5 },
  chipTeks: { fontSize: 12, fontFamily: font.semibold, color: colors.text },
  chipTeksAktif: { color: colors.white },
  tombolKanan: { alignSelf: 'flex-end', gap: 10, marginBottom: 10 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.floating,
  },
  bawah: { position: 'absolute', left: 12, right: 12, bottom: layout.tabBarSpace - 8 },
  ditekan: { opacity: 0.75 },
});
