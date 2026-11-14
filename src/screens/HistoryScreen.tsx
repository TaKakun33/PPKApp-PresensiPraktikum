import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Attendance, LeaveRequest, Session } from '../lib/types';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  subscribeAttendanceHistory,
  subscribeLeaveHistory,
} from '../services/historyService';
import { labelKategori } from '../services/aiService';
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
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Riwayat" />
        <View style={styles.state}>
          <LoadingState message="Memuat riwayat..." />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Riwayat" />
        <View style={styles.state}>
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
        </View>
      </View>
    );
  }

  const isBothEmpty = attendances.length === 0 && leaves.length === 0;

  if (isBothEmpty) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Riwayat" />
        <View style={styles.state}>
          <EmptyState
            compact
            icon="time-outline"
            title="Belum Ada Riwayat"
            message="Riwayat presensi dan permohonan izin kamu akan muncul di sini."
          />
        </View>
      </View>
    );
  }

  const dataAktif = activeTab === 'presensi' ? attendances : leaves;
  const jumlahCatatan = dataAktif.length;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Riwayat" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Pantau semua aktivitas presensi dan pengajuan izinmu.
        </Text>

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
          <View style={styles.bannerCircle} />
          <View style={styles.bannerIcon}>
            <Ionicons name="checkmark" size={23} color={colors.white} />
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerValue}>{persentaseHadir}%</Text>
            <Text style={styles.bannerLabel}>tingkat kehadiran semester ini</Text>
          </View>
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
                color={colors.primary}
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
                    <Ionicons name="checkmark" size={17} color={colors.primary} />
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {session?.praktikum || attendance.nama || 'Presensi Praktikum'}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {formatTimestamp(attendance.waktuHadir ?? (attendance as any).checkedInAt)}
                    </Text>
                  </View>
                  <StatusBadge status={terlambat ? 'terlambat' : 'hadir'} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.list}>
            {leaves.map((leave) => {
              const kategori = leave.kategoriAI || (leave as any).category;
              const waktu = (leave as any).createdAt ?? (leave as any).waktuPengajuan;

              return (
                <View key={leave.id} style={styles.leaveCard}>
                  <View style={styles.leaveTop}>
                    <View style={styles.itemIcon}>
                      <Ionicons name="document-text" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {leave.praktikum || `Sesi: ${leave.sessionId}`}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {formatTimestamp(waktu)}
                      </Text>
                    </View>
                    <StatusBadge status={leave.status} />
                  </View>

                  <Text style={styles.leaveReason}>
                    {leave.alasan || (leave as any).reason || '-'}
                  </Text>

                  {kategori ? (
                    <View style={styles.aiBadge}>
                      <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                      <Text style={styles.aiBadgeText}>Kategori AI: {labelKategori(kategori)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  state: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    paddingBottom: layout.tabBarSpace,
    gap: 16,
  },
  subtitle: { ...text.body },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontFamily: font.semibold, color: colors.textSecondary },
  segmentTextActive: { color: colors.white, fontFamily: font.bold },
  banner: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: 18,
  },
  bannerCircle: {
    position: 'absolute',
    right: -30,
    bottom: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    fontFamily: font.extraBold,
    color: colors.white,
    letterSpacing: -0.6,
  },
  bannerLabel: {
    fontSize: 11,
    fontFamily: font.medium,
    color: 'rgba(255,255,255,0.82)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: { ...text.sectionTitle },
  sectionCount: { ...text.caption },
  list: { gap: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  itemMeta: { ...text.caption },
  leaveCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 9,
  },
  leaveTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  leaveReason: { ...text.body, color: colors.textSecondary },
  aiBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tint,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  aiBadgeText: { fontSize: 10, fontFamily: font.semibold, color: colors.primary },
  noteBox: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.surface,
    gap: 2,
  },
  noteLabel: { fontSize: 10, fontFamily: font.bold, color: colors.textSecondary },
  noteText: { ...text.body, color: colors.text },
  emptyBox: {
    minHeight: 144,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  emptyText: { fontSize: 12, lineHeight: 17, fontFamily: font.medium, textAlign: 'center', color: colors.textSecondary },
});
