import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../app/constants';
import type { Attendance, Session } from '../app/types';
import { subscribeAttendances, subscribeSessions } from '../services/sessionService';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import { COLORS } from '../constants/colors';
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
    return <LoadingState message="Memuat profil asisten..." />;
  }

  if (role !== 'asisten') {
    return (
      <EmptyState
        title="Fitur khusus asisten"
        message="Pilih identitas asisten untuk melihat rekap kehadiran."
      />
    );
  }

  return (
    <FlatList
      data={attendanceRows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Rekap Kehadiran</Text>
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
              <View style={styles.selectedSessionInfo}>
                <Text style={styles.selectedSessionTitle}>{selectedSession.praktikum}</Text>
                <Text style={styles.selectedSessionDetails}>Kelas {selectedSession.kelasId}</Text>
                <Text style={styles.selectedSessionDetails}>
                  {selectedSession.tanggal}, {selectedSession.waktuMulai} - {selectedSession.waktuSelesai}
                </Text>
                <Text style={styles.selectedSessionDetails}>Ruangan: {selectedSession.ruangan}</Text>
              </View>
              <StatusBadge status={selectedSession.status} />
              {!isLoadingAttendances && selectedSession.status !== STATUS_SESI.BELUM ? (
                <View style={styles.countContainer}>
                  <Text style={[styles.countValue, styles.countValueSmall]}>{attendanceRows.length}</Text>
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
            title="Belum ada sesi yang ditugaskan"
            message="Sesi yang ditugaskan kepadamu akan muncul di sini."
          />
        ) : selectedSession?.status === STATUS_SESI.BELUM ? (
          <EmptyState
            title="Sesi belum dibuka"
            message="Rekap kehadiran tersedia setelah sesi dibuka."
          />
        ) : isLoadingAttendances ? (
          <LoadingState message="Memuat rekap kehadiran..." />
        ) : attendanceError ? (
          <EmptyState title="Tidak dapat memuat rekap" message={attendanceError} />
        ) : (
          <EmptyState
            title="Belum ada praktikan yang hadir"
            message="Daftar kehadiran untuk sesi ini masih kosong."
          />
        )
      }
      renderItem={({ item }) => (
        <View style={styles.attendanceCard}>
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
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: COLORS.background },
  header: { gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  feedback: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  errorFeedback: { borderColor: COLORS.danger },
  feedbackText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text,
  },
  sessionSelector: { gap: 8, paddingVertical: 8 },
  sessionOption: {
    width: 190,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  sessionOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionPressed: { opacity: 0.8 },
  sessionOptionTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  sessionOptionTitleSelected: { color: COLORS.primary },
  sessionOptionDetails: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  selectedSessionCard: {
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
  selectedSessionInfo: { gap: 4 },
  selectedSessionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  selectedSessionDetails: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  countValue: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.primary },
  countValueSmall: { fontSize: 16 },
  countLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.muted },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  studentInfo: { flex: 1, gap: 5 },
  studentName: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  studentNim: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  timeContainer: { alignItems: 'flex-end', gap: 4 },
  timeLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  timeValue: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
});
