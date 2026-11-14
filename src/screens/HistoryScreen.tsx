import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Attendance, LeaveRequest, Session } from '../lib/types';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  subscribeAttendanceHistory,
  subscribeLeaveHistory,
} from '../services/historyService';
import { subscribeSessions } from '../services/sessionService';

type RiwayatTab = 'presensi' | 'perizinan';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function timestampToDate(value: unknown): Date | null {
  if (value == null) return null;
  try {
    if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
    if (typeof (value as any)?.seconds === 'number') {
      return new Date((value as any).seconds * 1000);
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  } catch {
    // fallback di bawah
  }
  return null;
}

function formatTimestamp(value: unknown): string {
  const date = timestampToDate(value);
  if (!date) return value == null ? 'Menunggu sinkronisasi...' : '-';
  const jam = String(date.getHours()).padStart(2, '0');
  const menit = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()} • ${jam}.${menit}`;
}

function getLeaveStatusStyle(status: string) {
  const s = status?.toLowerCase();
  if (s === 'diterima') {
    return { bg: COLORS.successLight, text: COLORS.success, label: 'Diterima' };
  }
  if (s === 'ditolak') {
    return { bg: COLORS.dangerLight, text: COLORS.danger, label: 'Ditolak' };
  }
  return { bg: '#FFF4E5', text: COLORS.warning, label: 'Menunggu' };
}

function getAttendanceDate(attendance: Attendance): Date | null {
  return timestampToDate(attendance.waktuHadir ?? (attendance as any).checkedInAt);
}

function isTerlambat(attendance: Attendance, session?: Session): boolean {
  if (!session?.tanggal || !session.waktuMulai) return false;
  const checkIn = getAttendanceDate(attendance);
  if (!checkIn) return false;
  const mulai = new Date(`${session.tanggal}T${session.waktuMulai}:00`);
  if (Number.isNaN(mulai.getTime())) return false;
  return checkIn.getTime() > mulai.getTime() + 10 * 60 * 1000;
}

function tanggalLokal(): string {
  const now = new Date();
  const bulan = String(now.getMonth() + 1).padStart(2, '0');
  const tanggal = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${bulan}-${tanggal}`;
}

export default function HistoryScreen() {
  const { profile } = useAuth();
  const uid = profile?.id ?? '';

  const [activeTab, setActiveTab] = useState<RiwayatTab>('presensi');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attLoaded, setAttLoaded] = useState(false);
  const [leaveLoaded, setLeaveLoaded] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!uid || !profile) return;

    const unsubAtt = subscribeAttendanceHistory(
      uid,
      (data) => {
        setAttendances(data);
        setAttLoaded(true);
      },
      (err) => {
        setError(err.message);
        setAttLoaded(true);
      },
    );

    const unsubLeave = subscribeLeaveHistory(
      uid,
      (data) => {
        setLeaves(data);
        setLeaveLoaded(true);
      },
      (err) => {
        setError(err.message);
        setLeaveLoaded(true);
      },
    );

    const unsubSessions = subscribeSessions(
      profile,
      (data) => {
        setSessions(data);
        setSessionLoaded(true);
      },
      (err) => {
        setError(err.message);
        setSessionLoaded(true);
      },
    );

    return () => {
      unsubAtt();
      unsubLeave();
      unsubSessions();
    };
  }, [uid, profile, reloadKey]);

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const persentaseHadir = useMemo(() => {
    const hariIni = tanggalLokal();
    const lampau = sessions.filter(
      (session) => session.status === 'ditutup' || session.tanggal < hariIni,
    );
    if (lampau.length === 0) return 0;
    const sesiHadir = new Set(attendances.map((attendance) => attendance.sessionId));
    const hadir = lampau.filter((session) => sesiHadir.has(session.id)).length;
    return Math.round((hadir / lampau.length) * 100);
  }, [sessions, attendances]);

  const isLoading = Boolean(uid) && (!attLoaded || !leaveLoaded || !sessionLoaded);

  if (isLoading) {
    return <LoadingState message="Memuat riwayat..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setAttLoaded(false);
          setLeaveLoaded(false);
          setSessionLoaded(false);
          setError(null);
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  const isBothEmpty = attendances.length === 0 && leaves.length === 0;

  if (isBothEmpty) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Belum Ada Riwayat"
          message="Riwayat presensi dan permohonan izin kamu akan muncul di sini."
        />
      </View>
    );
  }

  const dataAktif = activeTab === 'presensi' ? attendances : leaves;
  const jumlahCatatan = dataAktif.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ACTIVITY LOG</Text>
        <Text style={styles.title}>Riwayat</Text>
        <Text style={styles.subtitle}>
          Pantau semua aktivitas presensi dan pengajuan izinmu.
        </Text>
      </View>

      <View style={styles.segmented}>
        {(['presensi', 'perizinan'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab === 'presensi' ? 'Presensi' : 'Perizinan'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="checkmark-sharp" size={24} color={COLORS.white} />
        </View>
        <View style={styles.bannerBody}>
          <Text style={styles.bannerValue}>{persentaseHadir}%</Text>
          <Text style={styles.bannerLabel}>tingkat kehadiran semester ini</Text>
        </View>
        <Ionicons
          name="sparkles"
          size={54}
          color="rgba(255,255,255,0.16)"
          style={styles.bannerSparkle}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'presensi' ? 'Presensi terbaru' : 'Perizinan terbaru'}
        </Text>
        <Text style={styles.sectionCount}>{jumlahCatatan} catatan</Text>
      </View>

      {jumlahCatatan === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name={activeTab === 'presensi' ? 'checkbox-outline' : 'document-text-outline'}
              size={24}
              color={COLORS.muted}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'presensi' ? 'Belum ada presensi' : 'Belum ada pengajuan izin'}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === 'presensi'
              ? 'Catatan kehadiranmu akan muncul di sini.'
              : 'Pengajuan izin yang kamu kirim akan muncul di sini.'}
          </Text>
        </View>
      ) : activeTab === 'presensi' ? (
        <View style={styles.list}>
          {attendances.map((attendance) => {
            const session = sessionById.get(attendance.sessionId);
            const terlambat = isTerlambat(attendance, session);
            return (
              <View key={attendance.id} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Ionicons name="checkmark" size={17} color={COLORS.primary} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {session?.praktikum || attendance.nama || 'Presensi Praktikum'}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {formatTimestamp(attendance.waktuHadir ?? (attendance as any).checkedInAt)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    terlambat ? styles.badgeTerlambat : styles.badgeHadir,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      terlambat ? styles.badgeTextTerlambat : styles.badgeTextHadir,
                    ]}
                  >
                    {terlambat ? 'Terlambat' : 'Hadir'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          {leaves.map((leave) => {
            const status = getLeaveStatusStyle(leave.status);
            const kategori = leave.kategoriAI || (leave as any).category;
            const waktu = (leave as any).createdAt ?? (leave as any).waktuPengajuan;

            return (
              <View key={leave.id} style={styles.leaveCard}>
                <View style={styles.leaveTop}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="document-text" size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {leave.praktikum || `Sesi: ${leave.sessionId}`}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {formatTimestamp(waktu)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.text }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.leaveReason}>
                  {leave.alasan || (leave as any).reason || '-'}
                </Text>

                {kategori ? (
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.aiBadgeText}>Kategori AI: {kategori}</Text>
                  </View>
                ) : null}

                {leave.catatanAsisten ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Catatan asisten</Text>
                    <Text style={styles.noteText}>{leave.catatanAsisten}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 18, paddingBottom: 36, gap: 16 },
  header: { gap: 3 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.muted,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 13,
  },
  segmentActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.muted,
  },
  segmentTextActive: { color: COLORS.text, fontFamily: 'PlusJakartaSans_700Bold' },
  banner: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 18,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBody: { flex: 1, gap: 1 },
  bannerValue: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.white,
    letterSpacing: -0.6,
  },
  bannerLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.82)',
  },
  bannerSparkle: { position: 'absolute', right: -8, bottom: -10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.muted,
  },
  list: { gap: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 13,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  itemMeta: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeHadir: { backgroundColor: COLORS.primaryLight },
  badgeTerlambat: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold' },
  badgeTextHadir: { color: COLORS.primary },
  badgeTextTerlambat: { color: COLORS.text },
  leaveCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 13,
    gap: 9,
  },
  leaveTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  leaveReason: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.textSecondary,
  },
  aiBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.primary,
  },
  noteBox: {
    padding: 10,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  noteLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.muted,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 7,
    padding: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderLight,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
});
