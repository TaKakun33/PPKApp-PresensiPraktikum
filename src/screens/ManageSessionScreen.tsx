import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';

type SessionAction = 'open' | 'close';

type PendingAction = {
  sessionId: string;
  action: SessionAction;
};

type ActionFeedback = {
  message: string;
  ok: boolean;
};

export default function ManageSessionScreen() {
  const { currentUser, getVisibleSessions, openSession, closeSession } = useApp();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const submittedAction = useRef<string | null>(null);

  const visibleSessions = getVisibleSessions();
  const sessions = currentUser.role === 'asisten' ? visibleSessions : [];
  const pendingSession = pendingAction
    ? sessions.find((session) => session.id === pendingAction.sessionId)
    : undefined;

  const requestAction = (sessionId: string, action: SessionAction) => {
    setFeedback(null);
    submittedAction.current = null;
    setPendingAction({ sessionId, action });
  };

  const confirmAction = () => {
    if (!pendingAction) return;

    const actionKey = `${pendingAction.action}:${pendingAction.sessionId}`;
    if (submittedAction.current === actionKey) return;

    submittedAction.current = actionKey;
    let completed = false;
    try {
      const result =
        pendingAction.action === 'open'
          ? openSession(pendingAction.sessionId)
          : closeSession(pendingAction.sessionId);
      setFeedback(result);
      setPendingAction(null);
      completed = true;
    } finally {
      if (!completed) submittedAction.current = null;
    }
  };

  const pendingActionLabel = pendingAction?.action === 'open' ? 'Buka' : 'Tutup';
  const pendingSessionName = pendingSession?.praktikum ?? 'sesi ini';

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
            {feedback ? (
              <View
                style={[
                  styles.feedback,
                  { borderColor: feedback.ok ? COLORS.success : COLORS.danger },
                ]}
              >
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.feedbackText,
                    { color: feedback.ok ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {feedback.message}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          currentUser.role === 'asisten' ? (
            <EmptyState
              title="Belum ada sesi yang ditugaskan"
              message="Sesi praktikum yang ditugaskan kepadamu akan muncul di sini."
            />
          ) : (
            <EmptyState
              title="Fitur khusus asisten"
              message="Pilih identitas asisten untuk mengelola sesi praktikum."
            />
          )
        }
        renderItem={({ item: session }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle} numberOfLines={2}>
                  {session.praktikum}
                </Text>
                <Text style={styles.moduleTitle} numberOfLines={2}>
                  {session.judulModul}
                </Text>
              </View>
              <StatusBadge status={session.status} />
            </View>

            <View style={styles.details}>
              <Text style={styles.detailText}>
                Kelas {session.kelas} | {session.tanggal}
              </Text>
              <Text style={styles.detailText}>Waktu: {session.waktu}</Text>
              <Text style={styles.detailText}>Ruangan: {session.ruangan}</Text>
            </View>

            {session.status === 'belum_dibuka' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Buka sesi ${session.praktikum}`}
                onPress={() => requestAction(session.id, 'open')}
                style={({ pressed }) => [styles.actionButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.actionButtonText}>Buka sesi</Text>
              </Pressable>
            ) : session.status === 'dibuka' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Tutup sesi ${session.praktikum}`}
                onPress={() => requestAction(session.id, 'close')}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.closeButton,
                  pressed && styles.buttonPressed,
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
        message={`Apakah kamu yakin ingin ${pendingActionLabel.toLowerCase()} ${pendingSessionName}?`}
        confirmLabel="Konfirmasi"
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: COLORS.background },
  header: { gap: 6, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: COLORS.muted },
  feedback: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  feedbackText: { fontSize: 14, fontWeight: '600' },
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
  sessionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  moduleTitle: { fontSize: 14, color: COLORS.muted },
  details: { gap: 4 },
  detailText: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  closeButton: { backgroundColor: COLORS.danger },
  buttonPressed: { opacity: 0.8 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
