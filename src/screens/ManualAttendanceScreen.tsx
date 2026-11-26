// Presensi oleh asisten pengampu: /presensi-manual?sessionId=xx
// Dibuka dari tombol "Presensi" di Kelola Sesi (hanya muncul pada sesi Dibuka).
// - Hadir : catat praktikan hadir (attendanceService.checkInManual).
// - Reset : kembalikan status Hadir / Izin praktikan ke awal.
// Semua tulisan lewat attendanceService; aturan akhirnya ditegakkan firestore.rules.
// - Kode presensi: kode unik 5 karakter sesi ini, dibagikan asisten ke praktikan untuk presensi sendiri.
// Layar Rekap hanya menampilkan hasilnya (tidak bisa mengubah).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import QrPresensi from '../components/QrPresensi';
import StatusBadge from '../components/StatusBadge';
import { colors, font, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useNamaKelas } from '../hooks/useNamaKelas';
import { STATUS_SESI } from '../lib/constants';
import type { Attendance, ClassDoc, LeaveRequest, Profile, Session } from '../lib/types';
import {
  checkInManual,
  pastikanKodePresensi,
  resetIzin,
  resetPresensi,
  subscribeKodePresensi,
} from '../services/attendanceService';
import { subscribeClass, subscribePeserta } from '../services/classService';
import {
  subscribeAttendances,
  subscribeLeaveRequestsForAsisten,
  subscribeSession,
} from '../services/sessionService';
import { REKAP_LABEL, buildRekap, waktuSesiLewat, type RekapRow } from '../utils/rekap';

type Aksi = { type: 'hadir' | 'reset'; row: RekapRow };

export default function ManualAttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { profile, role, loading: authLoading } = useAuth();
  const profileId = profile?.id;
  const insets = useSafeAreaInsets();
  const { labelKelas } = useNamaKelas();

  const [sessionState, setSessionState] = useState<{
    id: string;
    session: Session | null;
    error: string | null;
  } | null>(null);
  const [kelasState, setKelasState] = useState<{ kelasId: string; cls: ClassDoc | null } | null>(null);
  const [pesertaState, setPesertaState] = useState<{ key: string; items: Profile[] } | null>(null);
  const [attState, setAttState] = useState<{ sessionId: string; items: Attendance[] } | null>(null);
  const [izinAll, setIzinAll] = useState<LeaveRequest[]>([]);

  const [kodeState, setKodeState] = useState<{
    sessionId: string;
    kode: string | null;
    error: boolean;
  } | null>(null);
  const kodeDibuat = useRef<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  // Diperbarui berkala supaya status "Tidak hadir" muncul saat waktu sesi habis.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeSession(
      sessionId,
      (session) => setSessionState({ id: sessionId, session, error: null }),
      () =>
        setSessionState({
          id: sessionId,
          session: null,
          error: 'Gagal memuat sesi. Periksa koneksi internet kamu.',
        })
    );
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeAttendances(
      sessionId,
      (items) => setAttState({ sessionId, items }),
      () => setAttState({ sessionId, items: [] })
    );
  }, [sessionId]);

  const session =
    sessionState && sessionState.id === sessionId ? sessionState.session : null;
  const sessionError = sessionState && sessionState.id === sessionId ? sessionState.error : null;
  const sessionLoading = !!sessionId && !(sessionState && sessionState.id === sessionId);

  const kelasId = session?.kelasId ?? null;
  // Asisten hanya bisa membaca sesi kelas yang dia ampu (firestore.rules), jadi sesi yang terbaca
  // oleh asisten = sesi miliknya, baik sebagai pembuat maupun partner.
  const sesiMilikku = !!session && !!profileId && profile?.role === 'asisten';
  const sesiDibuka = session?.status === STATUS_SESI.DIBUKA;

  // Kode unik presensi (hanya terbaca oleh asisten pengampu, lihat firestore.rules).
  useEffect(() => {
    if (!sessionId || !sesiMilikku) return;
    return subscribeKodePresensi(
      sessionId,
      (kode) => setKodeState({ sessionId, kode, error: false }),
      () => setKodeState({ sessionId, kode: null, error: true })
    );
  }, [sessionId, sesiMilikku]);

  const kodeAktif = kodeState && kodeState.sessionId === sessionId ? kodeState : null;
  const kodeLoaded = kodeAktif !== null;
  const kodePresensi = kodeAktif?.kode ?? null;
  const kodeError = kodeAktif?.error ?? false;

  // Sesi yang sudah dibuka sebelum fitur kode ada belum punya kode: buatkan sekali.
  useEffect(() => {
    if (!session || !profileId || !sesiMilikku || !sesiDibuka) return;
    if (!kodeLoaded || kodeError || kodePresensi || kodeDibuat.current === session.id) return;
    kodeDibuat.current = session.id;
    void pastikanKodePresensi(session, profileId);
  }, [session, profileId, sesiMilikku, sesiDibuka, kodeLoaded, kodeError, kodePresensi]);

  useEffect(() => {
    if (!kelasId) return;
    return subscribeClass(
      kelasId,
      (cls) => setKelasState({ kelasId, cls }),
      () => setKelasState({ kelasId, cls: null })
    );
  }, [kelasId]);

  const kelasAktif = kelasState && kelasState.kelasId === kelasId ? kelasState.cls : null;
  const pesertaIds = kelasAktif?.pesertaIds ?? [];
  const pesertaKey = `${kelasId ?? ''}:${pesertaIds.join(',')}`;

  useEffect(() => {
    if (pesertaIds.length === 0) return;
    return subscribePeserta(
      pesertaIds,
      (items) => setPesertaState({ key: pesertaKey, items }),
      () => setPesertaState({ key: pesertaKey, items: [] })
    );
    // pesertaKey sudah mewakili isi pesertaIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesertaKey]);

  useEffect(() => {
    if (!profileId || role !== 'asisten') return;
    return subscribeLeaveRequestsForAsisten(profileId, setIzinAll, () => setIzinAll([]));
  }, [profileId, role]);

  const pesertaItems =
    pesertaIds.length > 0 && pesertaState && pesertaState.key === pesertaKey
      ? pesertaState.items
      : [];
  const attendances = attState && attState.sessionId === sessionId ? attState.items : [];
  const izinSesi = useMemo(
    () => izinAll.filter((l) => l.sessionId === sessionId),
    [izinAll, sessionId]
  );

  const dibuka = session?.status === STATUS_SESI.DIBUKA;
  const sesiLewat = dibuka && waktuSesiLewat(session, now);
  const rows = useMemo(
    () => buildRekap(pesertaItems, attendances, izinSesi, sesiLewat),
    [pesertaItems, attendances, izinSesi, sesiLewat]
  );
  const jumlahHadir = rows.filter((r) => r.status === 'hadir').length;

  const konfirmasi = async () => {
    const dipilih = aksi;
    setAksi(null);
    if (!dipilih || !session || !profileId || savingKey) return;

    const { type, row } = dipilih;
    setSavingKey(row.key);
    setNotice(null);

    let result;
    let berhasil = '';
    if (type === 'hadir') {
      result = await checkInManual(session, { id: row.key, nama: row.nama, nim: row.nim }, profileId);
      berhasil = `${row.nama} dicatat hadir.`;
    } else if (row.status === 'hadir') {
      result = await resetPresensi(session, row.key, profileId);
      berhasil = `Presensi ${row.nama} dikembalikan ke awal.`;
    } else {
      result = await resetIzin(session, row.key, profileId);
      berhasil = `Izin ${row.nama} dikembalikan ke awal.`;
    }

    setSavingKey(null);
    setNotice({ ok: result.ok, message: result.ok ? berhasil : result.message });
  };

  const teks = (() => {
    if (!aksi) return { title: '', message: '', label: 'Ya' };
    const { type, row } = aksi;
    const orang = `${row.nama}${row.nim ? ` (${row.nim})` : ''}`;
    const sesi = `"${session?.praktikum ?? ''}"`;
    if (type === 'hadir') {
      return {
        title: 'Catat hadir?',
        message: `${orang} akan dicatat hadir pada sesi ${sesi} dengan waktu saat ini.`,
        label: 'Catat hadir',
      };
    }
    return row.status === 'hadir'
      ? {
          title: 'Reset presensi?',
          message: `Presensi ${orang} pada sesi ${sesi} akan dihapus. Praktikan bisa presensi sendiri lagi atau dicatat ulang.`,
          label: 'Reset',
        }
      : {
          title: 'Reset izin?',
          message: `Izin yang diajukan ${orang} dikembalikan ke status Menunggu pada tab Izin.`,
          label: 'Reset',
        };
  })();

  const layar = (isi: ReactNode) => (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: 'Presensi' }} />
      {isi}
    </View>
  );

  if (authLoading || sessionLoading) {
    return layar(
      <View style={styles.state}>
        <LoadingState message="Memuat sesi..." />
      </View>
    );
  }

  if (role !== 'asisten') {
    return layar(
      <View style={styles.state}>
        <EmptyState
          icon="lock-closed-outline"
          title="Fitur khusus asisten"
          message="Hanya asisten pengampu yang dapat mencatat presensi."
        />
      </View>
    );
  }

  if (!sessionId || sessionError || !session || !sesiMilikku) {
    return layar(
      <View style={styles.state}>
        <EmptyState
          icon="calendar-outline"
          title="Sesi tidak tersedia"
          message={sessionError ?? 'Sesi tidak ditemukan atau bukan sesi yang kamu ampu.'}
        />
      </View>
    );
  }

  return layar(
    <>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{session.praktikum}</Text>
                  <Text style={styles.caption}>{labelKelas(session.kelasId)}</Text>
                </View>
                <StatusBadge status={session.status} />
              </View>
              <Text style={styles.caption}>
                {session.tanggal}, {session.waktuMulai} - {session.waktuSelesai} · {session.ruangan}
              </Text>
              <Text style={styles.caption}>
                {jumlahHadir} dari {rows.length} praktikan hadir
              </Text>
            </View>

            {dibuka ? (
              <View style={styles.kodeCard} accessibilityLabel="Kode presensi sesi ini">
                <Text style={styles.kodeLabel}>Kode presensi</Text>
                <Text
                  selectable
                  style={styles.kodeValue}
                  accessibilityLabel={kodePresensi ? `Kode presensi ${kodePresensi.split('').join(' ')}` : undefined}
                >
                  {kodePresensi ?? (kodeError ? '—' : '·····')}
                </Text>
                <Text style={styles.kodeHint}>
                  {kodeError
                    ? 'Kode tidak dapat dimuat. Periksa koneksi internet lalu buka ulang layar ini.'
                    : 'Bagikan kode ini ke praktikan di kelas. Praktikan memasukkannya atau memindai QR saat presensi sendiri.'}
                </Text>
                {kodePresensi ? (
                  <PrimaryButton
                    label="Tampilkan QR"
                    icon="qr-code-outline"
                    onPress={() => setQrVisible(true)}
                    style={styles.tombolQr}
                  />
                ) : null}
              </View>
            ) : null}

            {!dibuka ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text style={styles.feedbackText}>
                  Presensi hanya tersedia saat sesi sedang dibuka.
                </Text>
              </View>
            ) : null}

            {notice ? (
              <View
                style={[styles.feedback, notice.ok ? styles.successFeedback : styles.errorFeedback]}
              >
                <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
                  {notice.message}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Belum ada peserta"
            message="Tambahkan praktikan ke kelas ini lewat Kelola Kelas."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.badge}>
                <Text style={styles.initial}>{item.nama.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.nama}</Text>
                <Text style={styles.caption}>NIM: {item.nim || '—'}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text
                  style={[
                    styles.statusText,
                    item.status === 'hadir' && styles.statusHadir,
                    item.status === 'izin' && styles.statusIzin,
                    item.status === 'tidak' && styles.statusTidak,
                  ]}
                >
                  {REKAP_LABEL[item.status]}
                </Text>
                {item.status === 'hadir' && item.manual ? (
                  <Text style={styles.manualTag}>Dicatat asisten</Text>
                ) : null}
              </View>
            </View>

            {dibuka ? (
              item.status === 'hadir' || item.status === 'izin' ? (
                <PrimaryButton
                  label="Reset"
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  loading={savingKey === item.key}
                  disabled={savingKey !== null}
                  onPress={() => setAksi({ type: 'reset', row: item })}
                  accessibilityLabel={`Reset status ${item.nama}`}
                />
              ) : (
                <PrimaryButton
                  label="Hadir"
                  size="sm"
                  icon="checkmark"
                  loading={savingKey === item.key}
                  disabled={savingKey !== null}
                  onPress={() => setAksi({ type: 'hadir', row: item })}
                  accessibilityLabel={`Catat ${item.nama} hadir`}
                />
              )
            ) : null}
          </View>
        )}
      />

      <ConfirmModal
        visible={aksi !== null}
        title={teks.title}
        message={teks.message}
        confirmLabel={teks.label}
        onConfirm={konfirmasi}
        onCancel={() => setAksi(null)}
      />

      {/* QR dibuka di Modal agar menutupi seluruh layar dan tidak ikut ter-scroll. */}
      <Modal
        visible={qrVisible && dibuka && !!kodePresensi && !!sessionId}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setQrVisible(false)}
      >
        {kodePresensi && sessionId ? (
          <QrPresensi sessionId={sessionId} kode={kodePresensi} onTutup={() => setQrVisible(false)} />
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  state: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  header: { gap: 10, marginBottom: 4 },
  sessionCard: {
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sessionInfo: { flex: 1, gap: 3 },
  sessionTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  caption: { ...text.caption },
  kodeCard: {
    alignItems: 'center',
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.tint,
  },
  kodeLabel: { ...text.caption, fontFamily: font.semibold },
  kodeValue: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: font.extraBold,
    letterSpacing: 10,
    color: colors.secondaryText,
  },
  kodeHint: { ...text.caption, textAlign: 'center' },
  tombolQr: { alignSelf: 'stretch', marginTop: 8 },
  feedback: { padding: 12, borderWidth: 1, borderRadius: 14, backgroundColor: colors.card },
  errorFeedback: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  successFeedback: { borderColor: colors.success, backgroundColor: colors.successTint },
  feedbackText: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  initial: { fontSize: 14, fontFamily: font.extraBold, color: colors.secondaryText },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: colors.text },
  statusBox: { alignItems: 'flex-end', gap: 4 },
  statusText: { fontSize: 12, fontFamily: font.bold, color: colors.textSecondary, textAlign: 'right' },
  statusHadir: { color: colors.success },
  statusIzin: { color: colors.warning },
  statusTidak: { color: colors.danger },
  manualTag: { fontSize: 11, fontFamily: font.semibold, color: colors.textSecondary, textAlign: 'right' },
});
