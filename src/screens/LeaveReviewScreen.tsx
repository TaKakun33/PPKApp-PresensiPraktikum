import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_IZIN } from '../app/constants';
import type { LeaveRequest, Session } from '../app/types';
import {
  subscribeLeaveRequestsForAsisten,
  subscribeSessions,
  updateLeaveStatus,
} from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

type ReviewAction = 'diterima' | 'ditolak';

type PendingAction = {
  requestId: string;
  action: ReviewAction;
};

export default function LeaveReviewScreen() {
  const { profile, role, loading: authLoading } = useAuth();
  const [requestState, setRequestState] = useState<{
    profileId: string;
    requests: LeaveRequest[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [sessionState, setSessionState] = useState<{
    profileId: string;
    sessions: Session[];
    error: string | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || role !== 'asisten') {
      return;
    }

    const unsubscribe = subscribeLeaveRequestsForAsisten(
      profile.id,
      (items) => {
        const sorted = [...items].sort((a, b) => {
          const aPriority = a.status === STATUS_IZIN.MENUNGGU ? 0 : 1;
          const bPriority = b.status === STATUS_IZIN.MENUNGGU ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.nama.localeCompare(b.nama);
        });
        setRequestState({
          profileId: profile.id,
          requests: sorted,
          loading: false,
          error: null,
        });
      },
      (loadError) => {
        setRequestState({
          profileId: profile.id,
          requests: [],
          loading: false,
          error: loadError.message || 'Gagal memuat data izin.',
        });
      }
    );

    return unsubscribe;
  }, [profile, role]);

  useEffect(() => {
    if (!profile || role !== 'asisten') return;

    return subscribeSessions(
      profile,
      (sessions) => setSessionState({ profileId: profile.id, sessions, error: null }),
      (loadError) =>
        setSessionState({
          profileId: profile.id,
          sessions: [],
          error: loadError.message || 'Gagal memuat detail sesi.',
        })
    );
  }, [profile, role]);

  const currentRequestState =
    requestState && requestState.profileId === profile?.id ? requestState : null;
  const requests = useMemo(
    () => currentRequestState?.requests ?? [],
    [currentRequestState]
  );
  const isLoading = role === 'asisten' && (!currentRequestState || currentRequestState.loading);
  const error = currentRequestState?.error ?? null;
  const currentSessionState =
    sessionState && sessionState.profileId === profile?.id ? sessionState : null;
  const sessions = useMemo(
    () => currentSessionState?.sessions ?? [],
    [currentSessionState]
  );
  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions]
  );
  const sessionError = currentSessionState?.error ?? null;

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === STATUS_IZIN.MENUNGGU),
    [requests]
  );

  const selectedRequest = pendingAction
    ? requests.find((request) => request.id === pendingAction.requestId) ?? null
    : null;

  const confirmAction = async () => {
    if (!pendingAction || !selectedRequest || !profile || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      await updateLeaveStatus(
        selectedRequest.id,
        profile.id,
        pendingAction.action,
        pendingAction.action === 'diterima'
          ? 'Permohonan izin diterima oleh asisten.'
          : 'Permohonan izin ditolak oleh asisten.'
      );
      setFeedback(
        pendingAction.action === 'diterima'
          ? 'Permohonan izin berhasil diterima.'
          : 'Permohonan izin berhasil ditolak.'
      );
      setPendingAction(null);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Gagal memperbarui status izin.';
      setFeedback(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <LoadingState message="Memuat profil asisten..." />;
  }

  if (role !== 'asisten') {
    return (
      <EmptyState
        title="Fitur khusus asisten"
        message="Hanya asisten yang dapat meninjau pengajuan izin praktikkan."
      />
    );
  }

  return (
    <>
      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Review Izin</Text>
            <Text style={styles.subtitle}>
              Tinjau dan setujui atau tolak permohonan izin praktikan.
            </Text>

            {error ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text style={styles.feedbackText}>{error}</Text>
              </View>
            ) : null}
            {sessionError ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text style={styles.feedbackText}>{sessionError}</Text>
              </View>
            ) : null}

            {feedback ? (
              <View style={[styles.feedback, styles.successFeedback]}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Memuat permintaan izin..." />
          ) : (
            <EmptyState
              title="Tidak ada izin yang menunggu"
              message="Permohonan izin baru akan muncul di sini untuk ditinjau."
            />
          )
        }
        renderItem={({ item }) => {
          const session = sessionById.get(item.sessionId);
          return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.nama}</Text>
                <Text style={styles.studentNim}>NIM: {item.nim}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{item.status}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Praktikum</Text>
            <Text style={styles.valueText}>{session?.praktikum ?? item.praktikum}</Text>

            <Text style={styles.sectionLabel}>Sesi / Kelas</Text>
            <Text style={styles.valueText}>{item.kelasId} · {item.sessionId}</Text>
            <Text style={styles.sectionLabel}>Tanggal / Waktu</Text>
            <Text style={styles.valueText}>
              {session
                ? `${session.tanggal} · ${session.waktuMulai} - ${session.waktuSelesai}`
                : 'Detail tanggal sesi tidak tersedia.'}
            </Text>

            <Text style={styles.sectionLabel}>Alasan izin</Text>
            <Text style={styles.valueText}>{item.alasan}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Klasifikasi AI</Text>
                <Text style={styles.metaValue}>{item.kategoriAI ?? 'Belum tersedia'}</Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaLabel}>Status AI</Text>
                <Text style={styles.metaValue}>{item.aiStatus}</Text>
              </View>
            </View>

            {item.status === STATUS_IZIN.MENUNGGU ? (
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Terima izin ${item.nama}`}
                  disabled={submitting}
                  onPress={() => setPendingAction({ requestId: item.id, action: 'diterima' })}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.confirmButton,
                    pressed && !submitting && styles.buttonPressed,
                    submitting && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.actionButtonText}>Terima</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Tolak izin ${item.nama}`}
                  disabled={submitting}
                  onPress={() => setPendingAction({ requestId: item.id, action: 'ditolak' })}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.rejectButton,
                    pressed && !submitting && styles.buttonPressed,
                    submitting && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.actionButtonText}>Tolak</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          );
        }}
      />

      <ConfirmModal
        visible={pendingAction !== null}
        title={pendingAction?.action === 'diterima' ? 'Terima izin?' : 'Tolak izin?'}
        message={
          pendingAction && selectedRequest
            ? `Apakah kamu yakin ingin ${pendingAction.action === 'diterima' ? 'menerima' : 'menolak'} izin ${selectedRequest.nama} untuk ${selectedRequest.praktikum}?`
            : 'Konfirmasi perubahan status izin.'
        }
        confirmLabel={submitting ? 'Memproses...' : pendingAction?.action === 'diterima' ? 'Terima' : 'Tolak'}
        onConfirm={confirmAction}
        onCancel={() => {
          if (!submitting) setPendingAction(null);
        }}
      />
    </>
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
  successFeedback: { borderColor: COLORS.success },
  errorFeedback: { borderColor: COLORS.danger },
  feedbackText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text,
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  studentNim: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.warning,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
    textTransform: 'capitalize',
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  valueText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  metaLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.muted },
  metaValue: { marginTop: 4, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButton: { backgroundColor: COLORS.success },
  rejectButton: { backgroundColor: COLORS.danger },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.7 },
  actionButtonText: { color: COLORS.white, fontFamily: 'PlusJakartaSans_700Bold' },
});
