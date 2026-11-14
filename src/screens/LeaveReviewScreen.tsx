import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { STATUS_IZIN } from '../lib/constants';
import type { LeaveRequest, Session } from '../lib/types';
import {
  subscribeLeaveRequestsForAsisten,
  subscribeSessions,
  updateLeaveStatus,
} from '../services/sessionService';
import { labelKategori } from '../services/aiService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
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
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review Izin" />
        <View style={styles.state}>
          <LoadingState message="Memuat profil asisten..." />
        </View>
      </View>
    );
  }

  if (role !== 'asisten') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review Izin" />
        <View style={styles.state}>
          <EmptyState
            icon="lock-closed-outline"
            title="Fitur khusus asisten"
            message="Hanya asisten yang dapat meninjau pengajuan izin praktikan."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Review Izin" />
      <FlatList
        data={pendingRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
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
              icon="document-text-outline"
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
                <StatusBadge status={item.status} />
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
                  <Text style={styles.metaValue}>{item.kategoriAI ? labelKategori(item.kategoriAI) : 'Belum tersedia'}</Text>
                </View>
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Status AI</Text>
                  <Text style={styles.metaValue}>{item.aiStatus}</Text>
                </View>
              </View>

              {item.status === STATUS_IZIN.MENUNGGU ? (
                <View style={styles.actionRow}>
                  <PrimaryButton
                    label="Terima"
                    onPress={() => setPendingAction({ requestId: item.id, action: 'diterima' })}
                    disabled={submitting}
                    accessibilityLabel={`Terima izin ${item.nama}`}
                    style={styles.actionButton}
                  />
                  <PrimaryButton
                    label="Tolak"
                    variant="secondary"
                    onPress={() => setPendingAction({ requestId: item.id, action: 'ditolak' })}
                    disabled={submitting}
                    accessibilityLabel={`Tolak izin ${item.nama}`}
                    style={styles.actionButton}
                  />
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
  header: { gap: 8, marginBottom: 4 },
  subtitle: { ...text.body },
  feedback: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  successFeedback: { borderColor: colors.success, backgroundColor: colors.successTint },
  errorFeedback: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  feedbackText: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  studentInfo: { flex: 1, gap: 2 },
  studentName: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  studentNim: { ...text.caption },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: font.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  valueText: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  metaBox: {
    flex: 1,
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  metaLabel: { fontSize: 10, fontFamily: font.semibold, color: colors.textSecondary },
  metaValue: { marginTop: 3, fontSize: 12, fontFamily: font.semibold, color: colors.text },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  actionButton: { flex: 1, minHeight: 46, paddingHorizontal: 10 },
});
