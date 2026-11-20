import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../lib/constants';
import type { Attendance, ClassDoc, LeaveRequest, Profile, Session } from '../lib/types';
import { subscribeClass, subscribePeserta } from '../services/classService';
import {
  subscribeAttendances,
  subscribeLeaveRequestsForAsisten,
  subscribeSessions,
} from '../services/sessionService';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  REKAP_LABEL,
  buildRekap,
  toDateFromValue,
  waktuSesiLewat,
} from '../utils/rekap';
import { useNamaKelas } from '../hooks/useNamaKelas';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kelasState, setKelasState] = useState<{ kelasId: string; cls: ClassDoc | null } | null>(null);
  const [pesertaState, setPesertaState] = useState<{ key: string; items: Profile[] } | null>(null);
  const [izinAll, setIzinAll] = useState<LeaveRequest[]>([]);
  const [attendanceResult, setAttendanceResult] = useState<{
    sessionId: string;
    items: Attendance[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  // Jam sekarang, diperbarui berkala supaya status "Tidak hadir" muncul saat waktu sesi habis.
  const [now, setNow] = useState(() => Date.now());

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
            </Text>

            {loadError ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text style={styles.feedbackText}>{loadError}</Text>
              </View>
            ) : null}

            {sessions.length > 0 ? (
              <View style={styles.dropdownWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pilih sesi rekap"
                  accessibilityValue={{
                    text: selectedSession
                      ? `${selectedSession.praktikum}, ${labelKelas(selectedSession.kelasId)}`
                      : 'Belum dipilih',
                  }}
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [styles.dropdownButton, pressed && styles.optionPressed]}
                >
                  <View style={styles.dropdownTextWrap}>
                    <Text style={styles.dropdownCaption}>Sesi / Kelas</Text>
                    <Text numberOfLines={1} style={styles.dropdownValue}>
                      {selectedSession
                        ? `${selectedSession.praktikum} · ${labelKelas(selectedSession.kelasId)} · ${selectedSession.tanggal}`
                        : 'Pilih sesi'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.primary} />
                </Pressable>

                <Modal
                  transparent
                  animationType="fade"
                  visible={pickerOpen}
                  onRequestClose={() => setPickerOpen(false)}
                >
                  <View style={styles.pickerBackdrop}>
                    <Pressable
                      style={styles.pickerBackdropPress}
                      onPress={() => setPickerOpen(false)}
                      accessibilityLabel="Tutup pilihan sesi"
                    />
                    <View style={styles.pickerCard}>
                      <Text style={styles.pickerTitle}>Pilih Sesi Rekap</Text>
                      <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                        {sessions.map((session) => {
                          const selected = session.id === selectedSession?.id;
                          return (
                            <Pressable
                              key={session.id}
                              accessibilityRole="menuitem"
                              accessibilityState={{ selected }}
                              accessibilityLabel={`${session.praktikum}, ${labelKelas(session.kelasId)}, ${session.tanggal}`}
                              onPress={() => {
                                setSelectedSessionId(session.id);
                                setPickerOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.pickerOption,
                                selected && styles.pickerOptionSelected,
                                pressed && styles.optionPressed,
                              ]}
                            >
                              <View style={styles.dropdownTextWrap}>
                                <Text
                                  numberOfLines={2}
                                  style={[
                                    styles.pickerOptionTitle,
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
                              </View>
                              {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </View>
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

            </View>
          );
        }}
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
  feedbackText: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  optionPressed: { opacity: 0.8 },
  dropdownWrap: { gap: 8 },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.card,
  },
  dropdownTextWrap: { flex: 1, gap: 3 },
  dropdownCaption: { fontSize: 11, fontFamily: font.semibold, color: colors.textSecondary },
  dropdownValue: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  sessionOptionTitleSelected: { color: colors.primary },
  sessionOptionDetails: { fontSize: 12, fontFamily: font.medium, color: colors.textSecondary },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
  },
  pickerBackdropPress: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pickerCard: {
    maxHeight: '75%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  pickerTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  pickerList: { marginTop: 8 },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.input,
  },
  pickerOptionSelected: { backgroundColor: colors.tint },
  pickerOptionTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
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
