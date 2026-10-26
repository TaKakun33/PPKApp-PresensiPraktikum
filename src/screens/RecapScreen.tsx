import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import type { RecapItem } from '../data/types';
import { formatJam } from '../utils/format';

export default function RecapScreen() {
  const { currentUser, getVisibleSessions, getRecap } = useApp();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const visibleSessions = getVisibleSessions();
  const sessions = currentUser.role === 'asisten' ? visibleSessions : [];
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const recapItems =
    selectedSession && selectedSession.status !== 'belum_dibuka'
      ? getRecap(selectedSession.id)
      : [];

  const renderAttendance = ({ item }: { item: RecapItem }) => (
    <View style={styles.attendanceCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.user.nama}</Text>
        <Text style={styles.studentNim}>NIM: {item.user.nim}</Text>
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.timeLabel}>Waktu hadir</Text>
        <Text style={styles.timeValue}>{formatJam(item.attendance.waktuHadir)}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={recapItems}
      keyExtractor={(item) => item.attendance.id}
      renderItem={renderAttendance}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Rekap Kehadiran</Text>
          <Text style={styles.subtitle}>
            Pilih sesi untuk melihat daftar praktikan yang hadir.
          </Text>

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
                    accessibilityLabel={`${session.praktikum}, kelas ${session.kelas}, ${session.tanggal}`}
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
                      Kelas {session.kelas} · {session.tanggal}
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
                <Text style={styles.selectedSessionDetails}>
                  {selectedSession.judulModul} · Kelas {selectedSession.kelas}
                </Text>
                <Text style={styles.selectedSessionDetails}>
                  {selectedSession.tanggal}, {selectedSession.waktu} · {selectedSession.ruangan}
                </Text>
              </View>
              <StatusBadge status={selectedSession.status} />
              {selectedSession.status !== 'belum_dibuka' ? (
                <View style={styles.countContainer}>
                  <Text style={styles.countValue}>{recapItems.length}</Text>
                  <Text style={styles.countLabel}>praktikan hadir</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        currentUser.role !== 'asisten' ? (
          <EmptyState
            title="Fitur khusus asisten"
            message="Pilih identitas asisten untuk melihat rekap kehadiran."
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            title="Belum ada sesi yang ditugaskan"
            message="Sesi yang ditugaskan kepadamu akan muncul di sini."
          />
        ) : selectedSession?.status === 'belum_dibuka' ? (
          <EmptyState
            title="Sesi belum dibuka"
            message="Rekap kehadiran tersedia setelah sesi dibuka."
          />
        ) : (
          <EmptyState
            title="Belum ada praktikan yang hadir"
            message="Daftar kehadiran untuk sesi ini masih kosong."
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: COLORS.background },
  header: { gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: COLORS.muted },
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
  sessionOptionSelected: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  optionPressed: { opacity: 0.8 },
  sessionOptionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  sessionOptionTitleSelected: { color: COLORS.primary },
  sessionOptionDetails: { fontSize: 12, color: COLORS.muted },
  selectedSessionCard: {
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
  selectedSessionInfo: { gap: 4 },
  selectedSessionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  selectedSessionDetails: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  countValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  countLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
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
  studentName: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: COLORS.text },
  studentNim: { fontSize: 13, color: COLORS.muted },
  timeContainer: { alignItems: 'flex-end', gap: 4 },
  timeLabel: { fontSize: 11, color: COLORS.muted },
  timeValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});
