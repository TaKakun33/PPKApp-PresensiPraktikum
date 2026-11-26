import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import QrScannerPresensi from '../components/QrScannerPresensi';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import SuccessBottomSheet from '../components/SuccessBottomSheet';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { STATUS_IZIN, STATUS_LABEL, STATUS_SESI } from '../lib/constants';
import type { StatusIzin } from '../lib/constants';
import type { Session } from '../lib/types';
import { checkIn, jamSesiSudahLewat, subscribeCheckInState } from '../services/attendanceService';
import { ambilStatusLokasi, hitungJarakKeLab, pesanStatusLokasi, type LokasiStatus } from '../services/lokasiService';
import { parsingPayloadQR } from '../services/sessionCodeService';
import { subscribeSessions } from '../services/sessionService';
import { getLabs } from '../services/labService';
import { withTimeout } from '../services/serviceUtils';
import { formatJam } from '../utils/format';
import { KODE_PRESENSI_PANJANG, kodePresensiValid, normalisasiKode } from '../utils/kodePresensi';
import { koordinatValid } from '../utils/aktivitasLab';
import { formatJarakMeter } from '../utils/geo';

/** Batas menunggu data lab dari Firestore supaya layar tidak macet saat koneksi buruk. */
const BATAS_MUAT_LAB_MS = 12000;
/** Seberapa sering "sekarang" dicek ulang agar tombol presensi mati sendiri saat jam sesi berakhir. */
const DETAK_JAM_MS = 10000;

type LabInfo = { lat: number | null; lng: number | null; radiusMeter: number | null; nama: string | null };

type Props = {
  route?: {
    params?: {
      sessionId?: string;
    };
  };
};

export default function CheckInScreen({ route }: Props) {
  const localParams = useLocalSearchParams<{ sessionId?: string }>();
  const paramSessionId = route?.params?.sessionId ?? localParams?.sessionId;

  const { profile } = useAuth();
  const uid = profile?.id ?? '';

  // Tanpa parameter route (mis. dibuka dari tab Presensi), pilih otomatis sesi yang sedang Dibuka
  // di kelas praktikan. Parameter sessionId tetap diprioritaskan jika ada.
  const [autoSessionId, setAutoSessionId] = useState<string | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const sessionId = paramSessionId ?? autoSessionId ?? undefined;

  const [session, setSession] = useState<Session | null>(null);
  const [attended, setAttended] = useState(false);
  const [izinStatus, setIzinStatus] = useState<StatusIzin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTime, setSuccessTime] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Kode unik 5 karakter dari asisten; selalu disimpan dalam huruf besar.
  const [kode, setKode] = useState('');

  // Lokasi & radius (SRS-27, SRS-28)
  // lokasiRaw: hasil pembacaan perangkat (null = sedang memeriksa). Jarak & status radius diturunkan
  // dari lokasiRaw + labInfo di bawah, jadi urutan datangnya dua data ini tidak berpengaruh.
  const [lokasiRaw, setLokasiRaw] = useState<LokasiStatus | null>(null);
  const [labInfo, setLabInfo] = useState<LabInfo | null>(null);
  const [labMuat, setLabMuat] = useState<'memuat' | 'siap' | 'gagal'>('memuat');
  const [refreshLokasiKey, setRefreshLokasiKey] = useState(0);
  const [qrVisible, setQrVisible] = useState(false);
  const [sekarang, setSekarang] = useState(() => Date.now());

  useEffect(() => {
    if (paramSessionId || !profile || profile.role !== 'praktikan') {
      return;
    }

    return subscribeSessions(
      profile,
      (items) => {
        const dibuka = items
          .filter((item) => item.status === STATUS_SESI.DIBUKA)
          .sort((a, b) =>
            `${a.tanggal} ${a.waktuMulai}`.localeCompare(`${b.tanggal} ${b.waktuMulai}`)
          );
        setAutoSessionId(dibuka[0]?.id ?? null);
        setAutoLoaded(true);
      },
      (err) => {
        setError(err.message || 'Gagal memuat sesi praktikum.');
        setAutoLoaded(true);
      }
    );
    // profile berganti objek tiap snapshot profil; cukup bergantung pada id, peran, dan kelasIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramSessionId, profile?.id, profile?.role, (profile?.kelasIds ?? []).join(',')]);

  useEffect(() => {
    if (!sessionId || !uid) {
      return;
    }

    const unsubscribe = subscribeCheckInState(
      sessionId,
      uid,
      ({ session: s, attended: a, izinStatus: izin }) => {
        setSession(s);
        setAttended(a);
        setIzinStatus(izin);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId, uid, reloadKey]);

  const labKode = session?.labKode;

  // Muat lokasi lab sesi (SRS-27). Gagal / lambat ditampilkan sebagai banner, bukan layar macet.
  useEffect(() => {
    if (!sessionId || !labKode) return;

    let aktif = true;
    withTimeout(getLabs(), BATAS_MUAT_LAB_MS)
      .then((labs) => {
        if (!aktif) return;
        const lab = labs.find((l) => l.kode === labKode);
        setLabInfo(
          lab ? { lat: lab.lat, lng: lab.lng, radiusMeter: lab.radiusMeter, nama: lab.nama } : null
        );
        setLabMuat('siap');
      })
      .catch(() => {
        if (aktif) setLabMuat('gagal');
      });
    return () => {
      aktif = false;
    };
  }, [sessionId, labKode, refreshLokasiKey]);

  // Jam sesi: tombol presensi harus mati sendiri begitu jam selesai lewat (kode ikut kedaluwarsa).
  const sesiDibukaAktif = session?.status === STATUS_SESI.DIBUKA;
  useEffect(() => {
    if (!sesiDibukaAktif) return;
    const timer = setInterval(() => setSekarang(Date.now()), DETAK_JAM_MS);
    return () => clearInterval(timer);
  }, [sesiDibukaAktif]);
  const jamSesiHabis = sesiDibukaAktif && jamSesiSudahLewat(session, sekarang);

  // Cek lokasi perangkat selama sesi Dibuka dan praktikan masih bisa presensi (SRS-27, SRS-28).
  // Diulang lewat tombol "Perbarui lokasi" (refreshLokasiKey).
  const perluLokasi = sesiDibukaAktif && !attended && izinStatus !== STATUS_IZIN.DITERIMA && !jamSesiHabis;
  useEffect(() => {
    if (!perluLokasi) return;

    let aktif = true;
    ambilStatusLokasi()
      .then((status) => {
        if (aktif) setLokasiRaw(status);
      })
      .catch(() => {
        if (aktif) setLokasiRaw({ status: 'error', message: 'Lokasi perangkat belum bisa dibaca. Coba perbarui lokasi.' });
      });
    return () => {
      aktif = false;
    };
  }, [perluLokasi, refreshLokasiKey]);

  const perbaruiLokasi = () => {
    setLokasiRaw(null);
    setLabMuat('memuat');
    setRefreshLokasiKey((key) => key + 1);
  };

  // Turunan: data lab lengkap? sudah dalam radius?
  const labLengkap =
    !!labInfo &&
    koordinatValid(labInfo.lat, labInfo.lng) &&
    typeof labInfo.radiusMeter === 'number' &&
    labInfo.radiusMeter > 0;
  const labBelumDiatur = !!session && (!labKode || (labMuat === 'siap' && !labLengkap));
  const jarakLab =
    lokasiRaw?.status === 'siap' && labInfo && labLengkap
      ? hitungJarakKeLab(lokasiRaw.lokasi, labInfo.lat as number, labInfo.lng as number, labInfo.radiusMeter as number)
      : null;
  const posisiPerangkat = lokasiRaw?.status === 'siap' ? lokasiRaw.lokasi : null;

  if (!sessionId && error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <ErrorState message={error} onRetry={() => setError(null)} />
        </View>
      </View>
    );
  }

  if (!sessionId && !autoLoaded) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <LoadingState message="Mencari sesi yang sedang dibuka..." />
        </View>
      </View>
    );
  }

  if (!sessionId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <EmptyState
            compact
            icon="checkbox-outline"
            title="Belum Ada Sesi yang Dibuka"
            message="Presensi bisa dilakukan setelah asisten membuka sesi praktikum kelasmu."
          />
        </View>
      </View>
    );
  }

  if (loading && uid) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <LoadingState message="Memuat informasi sesi..." />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setReloadKey((key) => key + 1);
            }}
          />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <EmptyState
            title="Sesi Tidak Ditemukan"
            message="Data sesi praktikum tidak ditemukan atau telah dihapus."
          />
        </View>
      </View>
    );
  }

  const status = session.status;
  const isBelumDibuka = status === "belum_dibuka" || (status as string) === "Belum Dibuka";
  const isDitutup = status === "ditutup" || (status as string) === "Ditutup";
  const isDibuka = status === "dibuka" || (status as string) === "Dibuka";

  let buttonLabel = "Presensi Sekarang";
  let reason = "";
  let canPress = false;

  // Izin diterima = tidak bisa presensi lagi. Izin menunggu dibatalkan otomatis jika kamu presensi.
  const izinDiterima = izinStatus === STATUS_IZIN.DITERIMA;
  const izinMenunggu = izinStatus === STATUS_IZIN.MENUNGGU;

  if (attended) {
    buttonLabel = "Sudah Hadir";
    reason = "Kamu sudah melakukan presensi pada sesi ini.";
    canPress = false;
  } else if (izinDiterima) {
    buttonLabel = "Izin Diterima";
    reason = "Izinmu pada sesi ini sudah diterima asisten, jadi presensi tidak bisa dilakukan.";
    canPress = false;
  } else if (isBelumDibuka) {
    buttonLabel = "Belum Dibuka";
    reason = "Sesi belum dibuka oleh asisten.";
    canPress = false;
  } else if (isDitutup) {
    buttonLabel = "Ditutup";
    reason = "Sesi sudah ditutup.";
    canPress = false;
  } else if (isDibuka && jamSesiHabis) {
    buttonLabel = "Waktu Habis";
    reason = "Jam sesi sudah berakhir, jadi kode presensi tidak berlaku lagi. Hubungi asisten jika kamu perlu dicatat hadir.";
    canPress = false;
  } else if (isDibuka) {
    buttonLabel = isSubmitting ? "Memproses..." : "Presensi Sekarang";
    const lokasiValid = jarakLab?.dalamRadius === true;
    canPress = !isSubmitting && kodePresensiValid(kode) && lokasiValid;
    if (!isSubmitting && !kodePresensiValid(kode)) {
      reason = `Masukkan kode presensi ${KODE_PRESENSI_PANJANG} karakter dari asisten.`;
    } else if (!isSubmitting && !lokasiValid) {
      if (labBelumDiatur) {
        reason = "Lokasi lab belum diatur, jadi presensi belum bisa dilakukan. Hubungi asisten.";
      } else if (labMuat === 'gagal') {
        reason = "Data lokasi lab gagal dimuat. Ketuk Perbarui lokasi untuk mencoba lagi.";
      } else if (lokasiRaw && lokasiRaw.status !== 'siap') {
        reason = `${pesanStatusLokasi(lokasiRaw)} Lalu ketuk Perbarui lokasi.`;
      } else if (jarakLab && !jarakLab.dalamRadius) {
        reason = `Kamu di luar radius lab (${formatJarakMeter(jarakLab.jarakMeter)}). Pindah ke dalam lab lalu ketuk Perbarui lokasi.`;
      }
    }
  }

  // Form presensi (kode, banner lokasi) hanya tampil selama praktikan memang masih bisa presensi.
  const tampilFormPresensi = isDibuka && !attended && !izinDiterima && !jamSesiHabis;

  // Isi banner lokasi mengikuti kondisi nyata: memuat, lab belum diatur / gagal dimuat, error perangkat,
  // di luar radius, atau di dalam radius.
  let bannerLokasi: { icon: 'location-outline' | 'alert-circle-outline'; warna: string; teks: string; bisaPerbarui: boolean } | null = null;
  if (tampilFormPresensi) {
    if (labBelumDiatur) {
      bannerLokasi = { icon: 'alert-circle-outline', warna: colors.danger, teks: 'Lokasi lab belum diatur', bisaPerbarui: true };
    } else if (labMuat === 'gagal') {
      bannerLokasi = { icon: 'alert-circle-outline', warna: colors.danger, teks: 'Data lokasi lab gagal dimuat', bisaPerbarui: true };
    } else if (lokasiRaw === null || labMuat === 'memuat') {
      bannerLokasi = null; // sedang memeriksa; ditampilkan terpisah di bawah
    } else if (lokasiRaw.status !== 'siap') {
      bannerLokasi = { icon: 'alert-circle-outline', warna: colors.danger, teks: pesanStatusLokasi(lokasiRaw), bisaPerbarui: true };
    } else if (jarakLab) {
      bannerLokasi = jarakLab.dalamRadius
        ? { icon: 'location-outline', warna: colors.success, teks: `Di dalam radius lab (${formatJarakMeter(jarakLab.jarakMeter)})`, bisaPerbarui: true }
        : { icon: 'alert-circle-outline', warna: colors.danger, teks: `Di luar radius lab (${formatJarakMeter(jarakLab.jarakMeter)})`, bisaPerbarui: true };
    }
  }
  const lokasiSedangDiperiksa = tampilFormPresensi && !bannerLokasi;

  // Kirim presensi dengan kode tertentu. Dipakai tombol Presensi (kode ketik) dan hasil scan QR.
  const kirimPresensi = async (kodeDipakai: string) => {
    setIsSubmitting(true);
    const result = await checkIn(
      session.id,
      {
        uid: profile?.id,
        name: profile?.nama,
        nim: profile?.nim,
      },
      kodeDipakai,
      posisiPerangkat ? {
        lat: posisiPerangkat.lat,
        lng: posisiPerangkat.lng,
        akurasiMeter: posisiPerangkat.akurasiMeter,
      } : undefined,
      jarakLab?.jarakMeter
    );

    setIsSubmitting(false);

    if (result.ok) {
      setKode('');
      setSuccessTime(formatJam(new Date().toISOString()));
      setShowSuccess(true);
    } else {
      Alert.alert("Presensi Gagal", result.message);
    }
  };

  const handleCheckIn = () => {
    if (!canPress || isSubmitting) return;
    void kirimPresensi(kode);
  };

  const handleScanQR = () => {
    setQrVisible(true);
  };

  // Hasil scan langsung dikirim sebagai presensi: praktikan langsung melihat berhasil atau gagal,
  // tanpa mengisi kotak kode dan tanpa menekan tombol Presensi lagi.
  const handleScanResult = (payload: string) => {
    setQrVisible(false);
    if (isSubmitting) return;
    const parsed = parsingPayloadQR(payload);
    if (!parsed) {
      Alert.alert('QR Tidak Valid', 'Format kode QR tidak dikenali.');
      return;
    }
    if (parsed.sessionId !== session.id) {
      Alert.alert('QR Salah Sesi', 'Kode QR ini bukan untuk sesi praktikum yang sedang Anda buka.');
      return;
    }
    // Pemeriksaan sama dengan tombol Presensi; bila gagal, alasannya langsung ditampilkan.
    let gagal: string | null = null;
    if (jamSesiHabis) {
      gagal = 'Jam sesi sudah berakhir, jadi kode presensi tidak berlaku lagi. Hubungi asisten jika kamu perlu dicatat hadir.';
    } else if (labBelumDiatur) {
      gagal = 'Lokasi lab belum diatur, jadi presensi belum bisa dilakukan. Hubungi asisten.';
    } else if (labMuat === 'gagal') {
      gagal = 'Data lokasi lab gagal dimuat. Ketuk Perbarui lokasi lalu scan ulang.';
    } else if (lokasiRaw && lokasiRaw.status !== 'siap') {
      gagal = `${pesanStatusLokasi(lokasiRaw)} Lalu ketuk Perbarui lokasi dan scan ulang.`;
    } else if (!jarakLab) {
      gagal = 'Lokasi masih diperiksa. Tunggu sebentar lalu scan ulang.';
    } else if (!jarakLab.dalamRadius) {
      gagal = `Kamu di luar radius lab (${formatJarakMeter(jarakLab.jarakMeter)}). Pindah ke dalam lab lalu scan ulang.`;
    }
    if (gagal) {
      Alert.alert('Presensi Gagal', gagal);
      return;
    }
    void kirimPresensi(parsed.kode);
  };

  const waktu =
    (session as any).waktu ||
    (session.waktuMulai && session.waktuSelesai
      ? `${session.waktuMulai} - ${session.waktuSelesai}`
      : "-");

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Presensi" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{session.praktikum}</Text>
            <StatusBadge status={session.status} />
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Tanggal</Text>
              </View>
              <Text style={styles.infoValue}>{session.tanggal}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Waktu</Text>
              </View>
              <Text style={styles.infoValue}>{waktu}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Ruangan</Text>
              </View>
              <Text style={styles.infoValue}>{session.ruangan}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Status</Text>
              </View>
              <Text style={styles.infoValue}>{STATUS_LABEL[session.status]}</Text>
            </View>
          </View>

          {bannerLokasi ? (
            <View style={styles.lokasiBanner}>
              <Ionicons name={bannerLokasi.icon} size={16} color={bannerLokasi.warna} />
              <Text style={[styles.lokasiTe, styles.lokasiTeks]}>{bannerLokasi.teks}</Text>
              {bannerLokasi.bisaPerbarui ? (
                <Pressable
                  onPress={perbaruiLokasi}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Perbarui lokasi"
                  hitSlop={8}
                  style={({ pressed }) => [styles.perbarui, pressed && styles.perbaruiDitekan]}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={styles.perbaruiTeks}>Perbarui lokasi</Text>
                </Pressable>
              ) : null}
            </View>
          ) : lokasiSedangDiperiksa ? (
            <View style={styles.lokasiBanner}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.lokasiTe, styles.lokasiTeks]}>Memeriksa lokasi...</Text>
            </View>
          ) : null}

          {tampilFormPresensi ? (
            <View style={styles.kodeSection}>
              <Text style={styles.kodeLabel}>Kode presensi</Text>
              <View style={styles.kodeBaris}>
              <TextInput
                style={styles.kodeInput}
                value={kode}
                onChangeText={(t) => setKode(normalisasiKode(t))}
                placeholder="• • • • •"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                maxLength={KODE_PRESENSI_PANJANG}
                editable={!isSubmitting}
                returnKeyType="done"
                onSubmitEditing={handleCheckIn}
                accessibilityLabel="Kode presensi dari asisten"
              />
              <PrimaryButton
                label="Scan QR"
                icon="qr-code-outline"
                size="sm"
                onPress={handleScanQR}
                disabled={isSubmitting}
                style={styles.tombolScan}
              />
              </View>
            </View>
          ) : null}

          {tampilFormPresensi && izinMenunggu ? (
            <Text style={styles.izinNote}>
              Kamu punya pengajuan izin yang masih menunggu. Jika kamu presensi, pengajuan izin itu akan
              dibatalkan otomatis.
            </Text>
          ) : null}

          <PrimaryButton
            label={buttonLabel}
            onPress={handleCheckIn}
            disabled={!canPress}
            loading={isSubmitting}
            style={styles.button}
          />

          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        </Card>
      </ScrollView>

      <SuccessBottomSheet
        visible={showSuccess}
        sessionName={session.praktikum}
        waktuHadir={successTime}
        onClose={() => setShowSuccess(false)}
      />

      <QrScannerPresensi
        visible={qrVisible}
        onScan={handleScanResult}
        onClose={() => setQrVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  state: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: layout.tabBarSpace,
    gap: 16,
  },
  card: { padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: font.extraBold,
    color: colors.text,
  },
  infoSection: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  infoLabelWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  infoLabel: { ...text.body },
  infoValue: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.text,
    textAlign: "right",
  },
  lokasiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  lokasiTe: {
    ...text.body,
    color: colors.text,
    fontFamily: font.semibold,
  },
  lokasiTeks: { flex: 1 },
  perbarui: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perbaruiDitekan: { opacity: 0.6 },
  perbaruiTeks: { fontSize: 12, fontFamily: font.semibold, color: colors.primary },
  // Label di atas; kotak kode dan tombol Scan QR berbagi satu baris di bawahnya.
  kodeSection: { gap: 8, paddingTop: 4 },
  kodeLabel: { ...text.bodyStrong },
  kodeBaris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kodeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 24,
    fontFamily: font.extraBold,
    letterSpacing: 8,
    textAlign: "center",
  },
  tombolScan: {
    minWidth: 100,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  izinNote: {
    ...text.caption,
    padding: 12,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    color: colors.textSecondary,
  },
  button: { marginTop: 4 },
  reason: {
    ...text.caption,
    textAlign: "center",
    color: colors.textSecondary,
  },
});
