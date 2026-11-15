import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_IZIN, STATUS_SESI } from '../lib/constants';
import type { Attendance, ClassDoc, LeaveRequest, Profile, Session } from '../lib/types';
import {
  checkInManual,
  resetIzin,
  resetPresensi,
} from '../services/attendanceService';
import { subscribeClass, subscribePeserta } from '../services/classService';
import {
  subscribeAttendances,
  subscribeLeaveRequestsForAsisten,
  subscribeSessions,
} from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { formatTanggalJam } from '../utils/format';
import { useNamaKelas } from '../hooks/useNamaKelas';

function toDateFromValue(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  if (typeof value === 'object') {
    const maybeDate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof maybeDate.toDate === 'function') {
      return maybeDate.toDate();
    }

    if (typeof maybeDate.seconds === 'number') {
      return new Date(maybeDate.seconds * 1000);
    }
  }

  return null;
}

function normalizeTimestamp(value: unknown): string {
  const date = toDateFromValue(value);
  if (!date) return '—';
  return formatTanggalJam(date.toISOString());
}

type RekapStatus = 'hadir' | 'izin' | 'belum' | 'tidak';

type RekapRow = {
  key: string;
  nama: string;
  nim: string;
  status: RekapStatus;
  waktuTampil: string;
  waktuMs: number;
  /** Presensi dicatat manual oleh asisten (bukan presensi sendiri oleh praktikan). */
  manual: boolean;
  /** Dokumen izin ajuan praktikan di sesi ini (status apa pun), atau null. */
  leave: LeaveRequest | null;
};

const REKAP_LABEL: Record<RekapStatus, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  belum: 'Belum hadir',
  tidak: 'Tidak hadir',
};

/**
 * Urutan pilihan sesi: yang masih berjalan di depan.
 * Dibuka -> Belum Dibuka (keduanya yang terdekat dulu) -> Ditutup (yang terbaru dulu).
 */
const SESI_ORDER: Record<Session['status'], number> = {
  [STATUS_SESI.DIBUKA]: 0,
  [STATUS_SESI.BELUM]: 1,
  [STATUS_SESI.DITUTUP]: 2,
};

function urutkanSesiRekap(items: Session[]): Session[] {
  return [...items].sort((a, b) => {
    const grup = (SESI_ORDER[a.status] ?? 3) - (SESI_ORDER[b.status] ?? 3);
    if (grup !== 0) return grup;
    const waktu = `${a.tanggal} ${a.waktuMulai}`.localeCompare(`${b.tanggal} ${b.waktuMulai}`);
    return a.status === STATUS_SESI.DITUTUP ? -waktu : waktu;
  });
}

const REKAP_ORDER: Record<RekapStatus, number> = { hadir: 0, izin: 1, belum: 2, tidak: 3 };

/** Sesi dianggap sudah lewat waktunya jika tanggal + waktuSelesai (jam lokal) sudah terlewati. */
function waktuSesiLewat(session: Session | null, now: number): boolean {
  if (!session) return false;
  const tgl = /^(\d{4})-(\d{2})-(\d{2})$/.exec(session.tanggal ?? '');
  const jam = /^(\d{1,2}):(\d{2})$/.exec((session.waktuSelesai ?? '').replace('.', ':'));
  if (!tgl || !jam) return false;
  const akhir = new Date(Number(tgl[1]), Number(tgl[2]) - 1, Number(tgl[3]), Number(jam[1]), Number(jam[2]));
  return now > akhir.getTime();
}

/**
 * Gabungkan peserta kelas + presensi + izin menjadi satu daftar rekap.
 * Prioritas status: Hadir > Izin (hanya yang DITERIMA) > Tidak hadir (sesi selesai) > Belum hadir.
 * "Tidak hadir" tidak disimpan di database; ia hanya hasil perhitungan saat sesi sudah ditutup atau
 * waktunya lewat dan praktikan tidak punya presensi maupun izin diterima.
 * Praktikan yang tidak ada di daftar peserta tetap tampil jika sudah presensi.
 */
function buildRekap(
  peserta: Profile[],
  attendances: Attendance[],
  izinSesi: LeaveRequest[],
  sesiSelesai: boolean
): RekapRow[] {
  const hadirByUser = new Map(attendances.map((a) => [a.userId, a]));
  const izinByUser = new Map(izinSesi.map((l) => [l.userId, l]));
  const rows = new Map<string, RekapRow>();

  for (const p of peserta) {
    const att = hadirByUser.get(p.id);
    const leave = izinByUser.get(p.id) ?? null;
    const waktu = att ? toDateFromValue(att.waktuHadir) : null;
    const izinDiterima = leave?.status === STATUS_IZIN.DITERIMA;
    rows.set(p.id, {
      key: p.id,
      nama: p.nama,
      nim: p.nim ?? '',
      status: att ? 'hadir' : izinDiterima ? 'izin' : sesiSelesai ? 'tidak' : 'belum',
      waktuTampil: att ? normalizeTimestamp(att.waktuHadir) : '—',
      waktuMs: waktu?.getTime() ?? Number.MAX_SAFE_INTEGER,
      manual: att?.manual === true,
      leave,
    });
  }

  for (const att of attendances) {
    if (rows.has(att.userId)) continue;
    const waktu = toDateFromValue(att.waktuHadir);
    rows.set(att.userId, {
      key: att.userId,
      nama: att.nama || '(tanpa nama)',
      nim: att.nim ?? '',
      status: 'hadir',
      waktuTampil: normalizeTimestamp(att.waktuHadir),
      waktuMs: waktu?.getTime() ?? Number.MAX_SAFE_INTEGER,
      manual: att.manual === true,
      leave: izinByUser.get(att.userId) ?? null,
    });
  }

  return [...rows.values()].sort(
    (a, b) =>
      REKAP_ORDER[a.status] - REKAP_ORDER[b.status] ||
      (a.status === 'hadir' ? a.waktuMs - b.waktuMs : a.nama.localeCompare(b.nama))
  );
}

export default function RecapScreen() {
  const { profile, role, loading: authLoading } = useAuth();
  const profileId = profile?.id;
  const { labelKelas } = useNamaKelas();
  const [sessionState, setSessionState] = useState<{
    profileId: string;
    sessions: Session[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [kelasState, setKelasState] = useState<{ kelasId: string; cls: ClassDoc | null } | null>(null);
  const [pesertaState, setPesertaState] = useState<{ key: string; items: Profile[] } | null>(null);
  const [izinAll, setIzinAll] = useState<LeaveRequest[]>([]);
  const [attendanceResult, setAttendanceResult] = useState<{
    sessionId: string;
    items: Attendance[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  // Aksi manual asisten: aksi yang sedang dikonfirmasi, baris yang sedang disimpan, dan umpan balik.
  const [aksi, setAksi] = useState<{ type: 'hadir' | 'reset'; row: RekapRow } | null>(null);
  // Jam sekarang, diperbarui berkala supaya status "Tidak hadir" muncul saat waktu sesi habis.
  const [now, setNow] = useState(() => Date.now());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile || role !== 'asisten') {
      return;
    }

    const unsubscribe = subscribeSessions(
      profile,
      (items) => {
        setSessionState({
          profileId: profile.id,
          sessions: urutkanSesiRekap(items),
          loading: false,
          error: null,
        });
      },
      (error) => {
        setSessionState({
          profileId: profile.id,
          sessions: [],
          loading: false,
          error: error.message || 'Gagal memuat sesi praktikum.',
        });
      }
    );

    return unsubscribe;
    // profile berganti objek tiap snapshot profil; cukup bergantung pada id & peran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, role]);

  const currentSessionState =
    sessionState && sessionState.profileId === profile?.id ? sessionState : null;
  const sessions = useMemo(
    () => currentSessionState?.sessions ?? [],
    [currentSessionState]
  );
  const isLoadingSessions =
    role === 'asisten' && (!currentSessionState || currentSessionState.loading);
  const loadError = currentSessionState?.error ?? null;

  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      sessions.find((session) => session.status === STATUS_SESI.DIBUKA) ??
      sessions[0] ??
      null,
    [sessions, selectedSessionId]
  );

  const selectedSessionKey = selectedSession?.id ?? null;

  useEffect(() => {
    if (!selectedSessionKey) {
      return;
    }

    let active = true;

    const unsubscribe = subscribeAttendances(
      selectedSessionKey,
      (items) => {
        const sorted = [...items].sort((a, b) => {
          const timeA = toDateFromValue(a.waktuHadir)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const timeB = toDateFromValue(b.waktuHadir)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return timeA - timeB;
        });
        if (active) {
          setAttendanceResult({
            sessionId: selectedSessionKey,
            items: sorted,
            loading: false,
            error: null,
          });
        }
      },
      (error) => {
        if (active) {
          setAttendanceResult({
            sessionId: selectedSessionKey,
            items: [],
            loading: false,
            error: error.message || 'Gagal memuat rekap kehadiran.',
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [selectedSessionKey]);

  const selectedKelasId = selectedSession?.kelasId ?? null;

  // Kelas sesi terpilih -> daftar peserta (untuk menghitung yang belum hadir).
  useEffect(() => {
    if (!selectedKelasId) return;
    return subscribeClass(
      selectedKelasId,
      (cls) => setKelasState({ kelasId: selectedKelasId, cls }),
      () => setKelasState({ kelasId: selectedKelasId, cls: null })
    );
  }, [selectedKelasId]);

  const kelasAktif =
    kelasState && kelasState.kelasId === selectedKelasId ? kelasState.cls : null;
  const pesertaIds = kelasAktif?.pesertaIds ?? [];
  const pesertaKey = `${selectedKelasId ?? ''}:${pesertaIds.join(',')}`;

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

  // Izin milik kelas-kelas asisten ini; yang dipakai hanya yang DITERIMA untuk sesi terpilih.
  useEffect(() => {
    if (!profileId || role !== 'asisten') return;
    return subscribeLeaveRequestsForAsisten(profileId, setIzinAll, () => setIzinAll([]));
  }, [profileId, role]);

  const currentAttendanceResult =
    attendanceResult && attendanceResult.sessionId === selectedSessionKey
      ? attendanceResult
      : null;
  const attendances = selectedSessionKey ? currentAttendanceResult?.items ?? [] : [];
  const isLoadingAttendances =
    !!selectedSessionKey &&
    (!currentAttendanceResult || currentAttendanceResult.loading);
  const attendanceError = currentAttendanceResult?.error ?? null;
  const pesertaItems =
    pesertaIds.length > 0 && pesertaState && pesertaState.key === pesertaKey
      ? pesertaState.items
      : [];
  const izinSesi = useMemo(
    () => izinAll.filter((l) => l.sessionId === selectedSessionKey),
    [izinAll, selectedSessionKey]
  );
  // "Tidak hadir" hanya berlaku untuk sesi yang sudah ditutup, atau yang sedang dibuka tetapi
  // waktu selesainya sudah lewat. Sesi Belum Dibuka tidak pernah menandai siapa pun tidak hadir.
  const sesiSelesai =
    selectedSession?.status === STATUS_SESI.DITUTUP ||
    (selectedSession?.status === STATUS_SESI.DIBUKA && waktuSesiLewat(selectedSession, now));
  const attendanceRows = useMemo(
    () => buildRekap(pesertaItems, attendances, izinSesi, sesiSelesai),
    [pesertaItems, attendances, izinSesi, sesiSelesai]
  );
  const jumlah = {
    hadir: attendanceRows.filter((r) => r.status === 'hadir').length,
    izin: attendanceRows.filter((r) => r.status === 'izin').length,
    belum: attendanceRows.filter((r) => r.status === 'belum').length,
    tidak: attendanceRows.filter((r) => r.status === 'tidak').length,
  };

  // Tombol Hadir / Reset hanya aktif selagi sesi Dibuka (aturan bisnis + firestore.rules).
  // Setelah sesi ditutup, rekap final.
  const bisaUbahStatus = selectedSession?.status === STATUS_SESI.DIBUKA;

  const pilihSesi = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setNotice(null);
    setAksi(null);
  };

  const konfirmasiAksi = async () => {
    const dipilih = aksi;
    setAksi(null);
    if (!dipilih || !selectedSession || !profileId || savingKey) return;

    const { type, row } = dipilih;
    const target = { id: row.key, nama: row.nama, nim: row.nim };

    setSavingKey(row.key);
    setNotice(null);

    let result;
    let berhasil = '';
    if (type === 'hadir') {
      result = await checkInManual(selectedSession, target, profileId);
      berhasil = `${row.nama} dicatat hadir.`;
    } else if (row.status === 'hadir') {
      result = await resetPresensi(selectedSession, row.key, profileId);
      berhasil = `Presensi ${row.nama} dikembalikan ke awal.`;
    } else if (row.leave) {
      result = await resetIzin(selectedSession, row.key, profileId);
      berhasil = `Izin ${row.nama} dikembalikan ke awal.`;
    } else {
      result = { ok: false as const, message: 'Tidak ada status yang bisa direset.' };
    }

    setSavingKey(null);
    setNotice(result.ok ? { type: 'success', message: berhasil } : { type: 'error', message: result.message });
  };

  const teksKonfirmasi = (() => {
    if (!aksi) return { title: '', message: '', label: 'Ya' };
    const { type, row } = aksi;
    const orang = `${row.nama}${row.nim ? ` (${row.nim})` : ''}`;
    const sesi = `"${selectedSession?.praktikum ?? ''}"`;
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

  if (authLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Rekap" />
        <View style={styles.state}>
          <LoadingState message="Memuat profil asisten..." />
        </View>
      </View>
    );
  }

  if (role !== 'asisten') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Rekap" />
        <View style={styles.state}>
          <EmptyState
            icon="lock-closed-outline"
            title="Fitur khusus asisten"
            message="Pilih identitas asisten untuk melihat rekap kehadiran."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Rekap" />
      <FlatList
        data={attendanceRows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              Pilih sesi untuk melihat daftar praktikan yang hadir.
              {bisaUbahStatus ? ' Praktikan yang belum hadir bisa dicatat hadir secara manual.' : ''}
            </Text>

            {notice ? (
              <View
                style={[
                  styles.feedback,
                  notice.type === 'success' ? styles.successFeedback : styles.errorFeedback,
                ]}
              >
                <Text style={styles.feedbackText}>{notice.message}</Text>
              </View>
            ) : null}

            {loadError ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text style={styles.feedbackText}>{loadError}</Text>
              </View>
            ) : null}

            {sessions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sessionSelector}
              >
                {sessions.map((session) => {
                  const selected = session.id === selectedSession?.id;
                  return (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${session.praktikum}, ${labelKelas(session.kelasId)}, ${session.tanggal}`}
                      accessibilityState={{ selected }}
                      onPress={() => pilihSesi(session.id)}
                      style={({ pressed }) => [
                        styles.sessionOption,
                        selected && styles.sessionOptionSelected,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.sessionOptionTitle,
                          selected && styles.sessionOptionTitleSelected,
                        ]}
                      >
                        {session.praktikum}
                      </Text>
                      <Text
                        style={[
                          styles.sessionOptionDetails,
                          selected && styles.sessionOptionTitleSelected,
                        ]}
                      >
                        {labelKelas(session.kelasId)} · {session.tanggal}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {selectedSession ? (
              <View style={styles.selectedSessionCard}>
                <View style={styles.selectedSessionTop}>
                  <View style={styles.selectedSessionInfo}>
                    <Text style={styles.selectedSessionTitle}>{selectedSession.praktikum}</Text>
                    <Text style={styles.selectedSessionDetails}>{labelKelas(selectedSession.kelasId)}</Text>
                  </View>
                  <StatusBadge status={selectedSession.status} />
                </View>
                <Text style={styles.selectedSessionDetails}>
                  {selectedSession.tanggal}, {selectedSession.waktuMulai} - {selectedSession.waktuSelesai}
                </Text>
                <Text style={styles.selectedSessionDetails}>Ruangan: {selectedSession.ruangan}</Text>
                {!isLoadingAttendances && selectedSession.status !== STATUS_SESI.BELUM ? (
                  <View style={styles.countContainer}>
                    <View style={styles.countItem}>
                      <Text style={styles.countValue}>{jumlah.hadir}</Text>
                      <Text style={styles.countLabel}>hadir</Text>
                    </View>
                    <View style={styles.countItem}>
                      <Text style={[styles.countValue, styles.countIzin]}>{jumlah.izin}</Text>
                      <Text style={styles.countLabel}>izin</Text>
                    </View>
                    {sesiSelesai ? (
                      <View style={styles.countItem}>
                        <Text style={[styles.countValue, styles.countTidak]}>{jumlah.tidak}</Text>
                        <Text style={styles.countLabel}>tidak hadir</Text>
                      </View>
                    ) : (
                      <View style={styles.countItem}>
                        <Text style={[styles.countValue, styles.countBelum]}>{jumlah.belum}</Text>
                        <Text style={styles.countLabel}>belum hadir</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoadingSessions ? (
            <LoadingState message="Memuat sesi aktif..." />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Belum ada sesi yang ditugaskan"
              message="Sesi yang ditugaskan kepadamu akan muncul di sini."
            />
          ) : selectedSession?.status === STATUS_SESI.BELUM ? (
            <EmptyState
              icon="lock-closed-outline"
              title="Sesi belum dibuka"
              message="Rekap kehadiran tersedia setelah sesi dibuka."
            />
          ) : isLoadingAttendances ? (
            <LoadingState message="Memuat rekap kehadiran..." />
          ) : attendanceError ? (
            <EmptyState title="Tidak dapat memuat rekap" message={attendanceError} />
          ) : (
            <EmptyState
              icon="people-outline"
              title="Belum ada praktikan yang hadir"
              message="Daftar kehadiran untuk sesi ini masih kosong."
            />
          )
        }
        renderItem={({ item }) => {
          const sibuk = savingKey !== null;
          return (
            <View style={styles.attendanceCard}>
              <View style={styles.attendanceRow}>
                <View style={styles.studentBadge}>
                  <Text style={styles.studentInitial}>{item.nama.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{item.nama}</Text>
                  <Text style={styles.studentNim}>NIM: {item.nim || '—'}</Text>
                </View>
                <View style={styles.timeContainer}>
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
                  {item.status === 'hadir' ? <Text style={styles.timeValue}>{item.waktuTampil}</Text> : null}
                  {item.status === 'hadir' && item.manual ? (
                    <Text style={styles.manualTag}>Dicatat asisten</Text>
                  ) : null}
                </View>
              </View>

              {bisaUbahStatus ? (
                <View style={styles.actionRow}>
                  {item.status === 'hadir' || item.status === 'izin' ? (
                    <PrimaryButton
                      label="Reset"
                      variant="secondary"
                      size="sm"
                      icon="refresh"
                      loading={savingKey === item.key}
                      disabled={sibuk}
                      onPress={() => setAksi({ type: 'reset', row: item })}
                      accessibilityLabel={`Reset status ${item.nama}`}
                      style={styles.actionButton}
                    />
                  ) : (
                    <PrimaryButton
                      label="Hadir"
                      size="sm"
                      icon="checkmark"
                      loading={savingKey === item.key}
                      disabled={sibuk}
                      onPress={() => setAksi({ type: 'hadir', row: item })}
                      accessibilityLabel={`Catat ${item.nama} hadir`}
                      style={styles.actionButton}
                    />
                  )}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <ConfirmModal
        visible={aksi !== null}
        title={teksKonfirmasi.title}
        message={teksKonfirmasi.message}
        confirmLabel={teksKonfirmasi.label}
        onConfirm={konfirmasiAksi}
        onCancel={() => setAksi(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  state: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: layout.tabBarSpace,
    gap: 12,
  },
  header: { gap: 10, marginBottom: 4 },
  subtitle: { ...text.body },
  feedback: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  errorFeedback: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  successFeedback: { borderColor: colors.success, backgroundColor: colors.successTint },
  feedbackText: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  sessionSelector: { gap: 8, paddingVertical: 4 },
  sessionOption: {
    width: 190,
    padding: 13,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.card,
  },
  sessionOptionSelected: { borderColor: colors.primary, backgroundColor: colors.tint },
  optionPressed: { opacity: 0.8 },
  sessionOptionTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  sessionOptionTitleSelected: { color: colors.primary },
  sessionOptionDetails: { fontSize: 12, fontFamily: font.medium, color: colors.textSecondary },
  selectedSessionCard: {
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  selectedSessionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectedSessionInfo: { flex: 1, gap: 3 },
  selectedSessionTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  selectedSessionDetails: { ...text.caption },
  countContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 18,
    rowGap: 4,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  countItem: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  countIzin: { color: colors.warning },
  countBelum: { color: colors.textSecondary },
  countTidak: { color: colors.danger },
  statusText: { fontSize: 12, fontFamily: font.bold, color: colors.textSecondary, textAlign: 'right' },
  statusHadir: { color: colors.success },
  statusIzin: { color: colors.warning },
  statusTidak: { color: colors.danger },
  countValue: { fontSize: 22, fontFamily: font.extraBold, color: colors.primary },
  countLabel: { fontSize: 13, fontFamily: font.semibold, color: colors.textSecondary },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: { flex: 1, minHeight: 40 },
  attendanceCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  studentBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  studentInitial: { fontSize: 14, fontFamily: font.extraBold, color: colors.primary },
  studentInfo: { flex: 1, gap: 4 },
  studentName: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: colors.text },
  studentNim: { ...text.caption },
  timeContainer: { alignItems: 'flex-end', gap: 4 },
  timeLabel: { ...text.caption },
  manualTag: { fontSize: 11, fontFamily: font.semibold, color: colors.textSecondary, textAlign: 'right' },
  timeValue: { fontSize: 12, fontFamily: font.bold, color: colors.text, textAlign: 'right' },
});
