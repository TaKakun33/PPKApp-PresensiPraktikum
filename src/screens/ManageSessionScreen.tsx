import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../lib/constants';
import type { Session } from '../lib/types';
import { closeSession, openSession, subscribeSessions } from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

type SessionAction = 'open' | 'close';

type PendingAction = {
  sessionId: string;
  action: SessionAction;
};

type ActionFeedback = {
  message: string;
  ok: boolean;
};

const SESSION_PRIORITY: Record<string, number> = {
  [STATUS_SESI.DIBUKA]: 0,
  [STATUS_SESI.BELUM]: 1,
  [STATUS_SESI.DITUTUP]: 2,
};

export default function ManageSessionScreen() {
  const { profile, role, loading: authLoading } = useAuth();
  const [sessionState, setSessionState] = useState<{
    profileId: string;
    sessions: Session[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile || role !== 'asisten') {
      return;
    }

    const unsubscribe = subscribeSessions(
      profile,
      (items) => {
        const sorted = [...items].sort(
          (a, b) =>
            (SESSION_PRIORITY[a.status] ?? 99) - (SESSION_PRIORITY[b.status] ?? 99) ||
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
  const sessions = currentSessionState?.sessions ?? [];
  const isLoading = role === 'asisten' && (!currentSessionState || currentSessionState.loading);
  const loadError = currentSessionState?.error ?? null;

  const pendingSession = pendingAction
    ? sessions.find((session) => session.id === pendingAction.sessionId)
    : undefined;

  const requestAction = (sessionId: string, action: SessionAction) => {
    if (submitting) return;
    setFeedback(null);
    setPendingAction({ sessionId, action });
  };

  const confirmAction = async () => {
    if (!pendingAction || !profile || submitting) return;

    const targetSession = sessions.find((session) => session.id === pendingAction.sessionId);
    if (!targetSession) {
      setFeedback({ message: 'Sesi tidak ditemukan.', ok: false });
      setPendingAction(null);
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (pendingAction.action === 'open') {
        await openSession(targetSession.id, profile.id);
        setFeedback({
          message: `Sesi ${targetSession.praktikum} berhasil dibuka.`,
          ok: true,
        });
      } else {
        await closeSession(targetSession.id, profile.id);
        setFeedback({
          message: `Sesi ${targetSession.praktikum} berhasil ditutup.`,
          ok: true,
        });
      }
      setPendingAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengubah status sesi.';
      setFeedback({ message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingActionLabel = pendingAction?.action === 'open' ? 'Buka' : 'Tutup';
  const pendingSessionName = pendingSession?.praktikum ?? 'sesi ini';
  const confirmMessage =
    pendingAction?.action === 'close'
      ? `Apakah kamu yakin ingin menutup ${pendingSessionName}? Sesi yang sudah ditutup tidak dapat dibuka kembali.`
      : `Apakah kamu yakin ingin membuka ${pendingSessionName}?`;

  if (authLoading) {
    return <LoadingState message="Memuat profil asisten..." />;
  }

  if (role !== 'asisten') {
    return (
      <EmptyState
        title="Fitur khusus asisten"
        message="Hanya asisten pengampu yang dapat mengelola status sesi praktikum."
      />
    );
  }

  return (
    <>
      <FlatList
        data={sessions}
        keyExtractor={(session) => session.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Kelola Sesi</Text>
            <Text style={styles.subtitle}>
              Buka atau tutup sesi praktikum yang ditugaskan kepadamu.
            </Text>

            {loadError ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
                  {loadError}
                </Text>
              </View>
            ) : null}

            {feedback ? (
              <View
                style={[
                  styles.feedback,
                  feedback.ok ? styles.successFeedback : styles.errorFeedback,
                ]}
              >
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.feedbackText}
                >
                  {feedback.message}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingState message="Memuat sesi aktif..." />
          ) : (
            <EmptyState
              title="Belum ada sesi yang ditugaskan"
              message="Sesi praktikum yang ditugaskan kepadamu akan muncul di sini."
            />
          )
        }
        renderItem={({ item: session }) => (
          <View style={styles.card} key={session.id}>
            <View style={styles.cardHeader}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle} numberOfLines={2}>
                  {session.praktikum}
                </Text>
                <Text style={styles.moduleTitle} numberOfLines={2}>
                  {session.kelasId}
                </Text>
              </View>
              <StatusBadge status={session.status} />
            </View>

            <View style={styles.details}>
              <Text style={styles.detailText}>
                {session.tanggal} | {session.waktuMulai} - {session.waktuSelesai}
              </Text>
              <Text style={styles.detailText}>Ruangan: {session.ruangan}</Text>
            </View>

            {session.status === STATUS_SESI.BELUM ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Buka sesi ${session.praktikum}`}
                disabled={submitting}
                onPress={() => requestAction(session.id, 'open')}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && !submitting && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.actionButtonText}>Buka sesi</Text>
              </Pressable>
            ) : session.status === STATUS_SESI.DIBUKA ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Tutup sesi ${session.praktikum}`}
                disabled={submitting}
                onPress={() => requestAction(session.id, 'close')}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.closeButton,
                  pressed && !submitting && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.actionButtonText}>Tutup sesi</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />

      <ConfirmModal
        visible={pendingAction !== null}
        title={`${pendingActionLabel} sesi?`}
        message={confirmMessage}
        confirmLabel={submitting ? 'Memproses...' : 'Konfirmasi'}
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
  header: { gap: 6, marginBottom: 8 },
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
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionInfo: { flex: 1, gap: 4 },
  sessionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  moduleTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  details: { gap: 4 },
  detailText: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  closeButton: { backgroundColor: COLORS.danger },
  buttonDisabled: { opacity: 0.7 },
  buttonPressed: { opacity: 0.8 },
  actionButtonText: { color: COLORS.white, fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});
