import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../lib/constants';
import type { Session } from '../lib/types';
import { closeSession, openSession, subscribeSessions } from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
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
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kelola Sesi" />
        <View style={styles.state}>
          <LoadingState message="Memuat profil asisten..." />
        </View>
      </View>
    );
  }

  if (role !== 'asisten') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kelola Sesi" />
        <View style={styles.state}>
          <EmptyState
            icon="lock-closed-outline"
            title="Fitur khusus asisten"
            message="Hanya asisten pengampu yang dapat mengelola status sesi praktikum."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Kelola Sesi" />
      <FlatList
        data={sessions}
        keyExtractor={(session) => session.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
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
              icon="calendar-outline"
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
                  Kelas {session.kelasId}
                </Text>
              </View>
              <StatusBadge status={session.status} />
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {session.tanggal} · {session.waktuMulai} - {session.waktuSelesai}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.detailText}>{session.ruangan}</Text>
              </View>
            </View>

            {session.status === STATUS_SESI.BELUM ? (
              <PrimaryButton
                label="Buka sesi"
                onPress={() => requestAction(session.id, 'open')}
                disabled={submitting}
                accessibilityLabel={`Buka sesi ${session.praktikum}`}
              />
            ) : session.status === STATUS_SESI.DIBUKA ? (
              <PrimaryButton
                label="Tutup sesi"
                variant="secondary"
                onPress={() => requestAction(session.id, 'close')}
                disabled={submitting}
                accessibilityLabel={`Tutup sesi ${session.praktikum}`}
              />
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
    padding: 16,
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionInfo: { flex: 1, gap: 4 },
  sessionTitle: { fontSize: 15, lineHeight: 21, fontFamily: font.bold, color: colors.text },
  moduleTitle: { ...text.caption },
  details: { gap: 7 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailText: { flex: 1, ...text.caption },
});
