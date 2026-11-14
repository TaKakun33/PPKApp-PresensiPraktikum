import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../lib/constants';
import type { Attendance, Session } from '../lib/types';
import { subscribeAttendances, subscribeSessions } from '../services/sessionService';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { formatTanggalJam } from '../utils/format';

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

export default function RecapScreen() {
  const { profile, role, loading: authLoading } = useAuth();
  const [sessionState, setSessionState] = useState<{
    profileId: string;
    sessions: Session[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [attendanceResult, setAttendanceResult] = useState<{
    sessionId: string;
    items: Attendance[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!profile || role !== 'asisten') {
      return;
    }

    const unsubscribe = subscribeSessions(
      profile,
      (items) => {
        const sorted = [...items].sort(
          (a, b) =>
            a.tanggal.localeCompare(b.tanggal) ||
            a.waktuMulai.localeCompare(b.waktuMulai)
        );
        setSessionState({
          profileId: profile.id,
          sessions: sorted,
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
  }, [profile, role]);

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

  const currentAttendanceResult =
    attendanceResult && attendanceResult.sessionId === selectedSessionKey
      ? attendanceResult
      : null;
  const attendances = selectedSessionKey ? currentAttendanceResult?.items ?? [] : [];
  const isLoadingAttendances =
    !!selectedSessionKey &&
    (!currentAttendanceResult || currentAttendanceResult.loading);
  const attendanceError = currentAttendanceResult?.error ?? null;
  const attendanceRows = attendances.map((item) => ({
    ...item,
    waktuTampil: normalizeTimestamp(item.waktuHadir),
  }));

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
        keyExtractor={(item) => item.id}
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sessionSelector}
              >
                {sessions.map((session) => {
                  const selected = session.id === selectedSessionId;
                  return (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${session.praktikum}, kelas ${session.kelasId}, ${session.tanggal}`}
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedSessionId(session.id)}
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
                        {session.kelasId} · {session.tanggal}
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
                    <Text style={styles.selectedSessionDetails}>Kelas {selectedSession.kelasId}</Text>
                  </View>
                  <StatusBadge status={selectedSession.status} />
                </View>
                <Text style={styles.selectedSessionDetails}>
                  {selectedSession.tanggal}, {selectedSession.waktuMulai} - {selectedSession.waktuSelesai}
                </Text>
                <Text style={styles.selectedSessionDetails}>Ruangan: {selectedSession.ruangan}</Text>
                {!isLoadingAttendances && selectedSession.status !== STATUS_SESI.BELUM ? (
                  <View style={styles.countContainer}>
                    <Text style={styles.countValue}>{attendanceRows.length}</Text>
                    <Text style={styles.countLabel}>praktikan hadir</Text>
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
        renderItem={({ item }) => (
          <View style={styles.attendanceCard}>
            <View style={styles.studentBadge}>
              <Text style={styles.studentInitial}>{item.nama?.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.nama}</Text>
              <Text style={styles.studentNim}>NIM: {item.nim}</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeLabel}>Waktu hadir</Text>
              <Text style={styles.timeValue}>{item.waktuTampil}</Text>
            </View>
          </View>
        )}
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
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  countValue: { fontSize: 22, fontFamily: font.extraBold, color: colors.primary },
  countLabel: { fontSize: 13, fontFamily: font.semibold, color: colors.textSecondary },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  timeValue: { fontSize: 12, fontFamily: font.bold, color: colors.text, textAlign: 'right' },
});
