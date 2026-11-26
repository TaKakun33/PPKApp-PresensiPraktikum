import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { checkIn, subscribeCheckInState } from '../services/attendanceService';
import { ambilStatusLokasi, hitungJarakKeLab } from '../services/lokasiService';
import { parsingPayloadQR } from '../services/sessionCodeService';
import { subscribeSessions } from '../services/sessionService';
import { getLabs } from '../services/labService';
import { formatJam } from '../utils/format';
import { KODE_PRESENSI_PANJANG, kodePresensiValid, normalisasiKode } from '../utils/kodePresensi';
import { formatJarakMeter } from '../utils/geo';

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
  const [lokasiStatus, setLokasiStatus] = useState<{ status: 'memuat' | 'siap' | 'izin_ditolak' | 'gps_mati' | 'lokasi_tidak_tersedia' | 'timeout' | 'offline' | 'error'; message?: string; jarakMeter?: number; dalamRadius?: boolean }>({ status: 'memuat' });
  const [lokasiPosisi, setLokasiPosisi] = useState<{ lat: number; lng: number; akurasiMeter: number } | null>(null);
  const [labInfo, setLabInfo] = useState<{ lat: number | null; lng: number | null; radiusMeter: number | null; nama: string | null } | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

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

  // Muat lokasi lab sesi (SRS-27)
  useEffect(() => {
    if (!sessionId || !session?.labKode) return;

    let aktif = true;
    getLabs().then((labs) => {
      if (!aktif) return;
      const lab = labs.find((l) => l.kode === session?.labKode);
      if (lab) {
        setLabInfo({
          lat: lab.lat,
          lng: lab.lng,
          radiusMeter: lab.radiusMeter,
          nama: lab.nama,
        });
      }
    });
    return () => {
      aktif = false;
    };
  }, [sessionId, session?.labKode]);

  // Cek lokasi perangkat saat sesi Dibuka dan lab info tersedia (SRS-27, SRS-28)
  useEffect(() => {
    if (!sessionId || !session || session.status !== STATUS_SESI.DIBUKA || attended) {
      if (session?.status !== STATUS_SESI.DIBUKA) {
        const timer = setTimeout(() => {
          setLokasiStatus({ status: 'siap' });
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    let aktif = true;
    const cekLokasi = async () => {
      const status = await ambilStatusLokasi();
      if (!aktif) return;

      if (status.status === 'siap' && status.lokasi && labInfo && labInfo.lat != null && labInfo.lng != null && labInfo.radiusMeter != null) {
        setLokasiPosisi(status.lokasi);
        const jarak = hitungJarakKeLab(
          status.lokasi,
          labInfo.lat,
          labInfo.lng,
          labInfo.radiusMeter
        );
        setLokasiStatus({
          status: 'siap',
          jarakMeter: jarak.jarakMeter,
          dalamRadius: jarak.dalamRadius,
        });
      } else {
        setLokasiStatus({
          status: status.status,
          message: status.message,
        });
      }
    };

    cekLokasi();
    return () => {
      aktif = false;
    };
  }, [sessionId, session, attended, labInfo]);

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
  } else if (isDibuka) {
    buttonLabel = isSubmitting ? "Memproses..." : "Presensi Sekarang";
    const lokasiValid =
      lokasiStatus.status === 'siap' && lokasiStatus.dalamRadius === true;
    canPress = !isSubmitting && kodePresensiValid(kode) && lokasiValid;
    if (!isSubmitting && !kodePresensiValid(kode)) {
      reason = `Masukkan kode presensi ${KODE_PRESENSI_PANJANG} karakter dari asisten.`;
    } else if (!isSubmitting && !lokasiValid && kodePresensiValid(kode)) {
      if (lokasiStatus.status === 'siap' && lokasiStatus.dalamRadius === false) {
        reason = `Anda di luar radius lab (${formatJarakMeter(lokasiStatus.jarakMeter ?? 0)}). Pindah ke dalam lab lalu coba lagi.`;
      }
    }
  }

  const handleCheckIn = async () => {
    if (!canPress || isSubmitting) return;

    setIsSubmitting(true);
    const result = await checkIn(
      session.id,
      {
        uid: profile?.id,
        name: profile?.nama,
        nim: profile?.nim,
      },
      kode,
      lokasiPosisi ? {
        lat: lokasiPosisi.lat,
        lng: lokasiPosisi.lng,
        akurasiMeter: lokasiPosisi.akurasiMeter,
      } : undefined,
      lokasiStatus.jarakMeter
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

  const handleScanQR = () => {
    setQrVisible(true);
  };

  const handleScanResult = (payload: string) => {
    setQrVisible(false);
    const parsed = parsingPayloadQR(payload);
    if (parsed) {
      if (session && parsed.sessionId !== session.id) {
        Alert.alert('QR Salah Sesi', 'Kode QR ini bukan untuk sesi praktikum yang sedang Anda buka.');
        return;
      }
      setKode(parsed.kode);
    } else {
      Alert.alert('QR Tidak Valid', 'Format kode QR tidak dikenali.');
    }
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

          {isDibuka && !attended && !izinDiterima && lokasiStatus.status !== 'memuat' ? (
            <View style={styles.lokasiBanner}>
              {lokasiStatus.status === 'siap' ? (
                <>
                  <Ionicons name="location-outline" size={16} color={colors.success} />
                  <Text style={styles.lokasiTe}>
                    Di dalam radius lab ({formatJarakMeter(lokasiStatus.jarakMeter ?? 0)})
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name={'alert-circle-outline'}
                    size={16}
                    color={colors.danger}
                  />
                  <Text style={styles.lokasiTe}>{lokasiStatus.message ?? 'Lokasi tidak valid'}</Text>
                </>
              )}
            </View>
          ) : null}

          {isDibuka && !attended && !izinDiterima ? (
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

          {isDibuka && !attended && izinMenunggu ? (
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
