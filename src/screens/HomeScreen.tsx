// Dashboard utama praktikan: ringkasan kehadiran, izin, dan jadwal terdekat.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Attendance, ClassDoc, LeaveRequest, Session } from '../lib/types';
import { STATUS_IZIN } from '../lib/constants';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import { colors, font, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../navigation/LogoutButton';
import ProfileButton from '../navigation/ProfileButton';
import { getNamaPengguna, subscribeClassesForUser } from '../services/classService';
import { subscribeAttendanceHistory, subscribeLeaveHistory } from '../services/historyService';
import { labelWaktu, subscribeSessions, urutkanSesi } from '../services/sessionService';
import { formatTanggal } from '../utils/format';

const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
const HARI_SINGKAT = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
const BULAN_SINGKAT = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

function parseTanggal(tanggal: string): Date | null {
  const date = new Date(`${tanggal}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tanggalHariIni(): string {
  const now = new Date();
  const bulan = String(now.getMonth() + 1).padStart(2, '0');
  const tanggal = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${bulan}-${tanggal}`;
}

function labelHariIni(): string {
  const now = new Date();
  return `${HARI[now.getDay()]}, ${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;
}

function sapaan(): string {
  const jam = new Date().getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function inisial(nama: string): string {
  return (
    nama
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((kata) => kata[0])
      .join('')
      .toUpperCase() || 'P'
  );
}

function bagianTanggal(tanggal: string): { hari: string; angka: string; bulan: string } {
  const date = parseTanggal(tanggal);
  if (!date) {
    return { hari: 'SEN', angka: '00', bulan: 'JAN' };
  }
  return {
    hari: HARI_SINGKAT[date.getDay()],
    angka: String(date.getDate()).padStart(2, '0'),
    bulan: BULAN_SINGKAT[date.getMonth()],
  };
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [attendances, setAttendances] = useState<Attendance[] | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null);
  const [namaAsisten, setNamaAsisten] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile) return;

    const onError = (e: Error) =>
      setError(e.message || 'Data dashboard gagal dimuat. Periksa koneksi internet.');

    const unsubSessions = subscribeSessions(
      profile,
      (data) => setSessions(urutkanSesi(data)),
      onError,
    );
    const unsubClasses = subscribeClassesForUser(profile, setClasses, onError);
    const unsubAttendances = subscribeAttendanceHistory(profile.id, setAttendances, onError);
    const unsubLeaves = subscribeLeaveHistory(profile.id, setLeaves, onError);

    return () => {
      unsubSessions();
      unsubClasses();
      unsubAttendances();
      unsubLeaves();
    };
  }, [profile, reloadKey]);

  const asistenIds = useMemo(() => {
    const ids = new Set<string>();
    sessions?.forEach((session) => session.asistenId && ids.add(session.asistenId));
    classes?.forEach((kelas) => kelas.asistenId && ids.add(kelas.asistenId));
    return [...ids].sort();
  }, [sessions, classes]);

  const asistenKey = asistenIds.join('|');

  useEffect(() => {
    if (!asistenKey) return;

    let aktif = true;
    const ids = asistenKey.split('|').filter(Boolean);

    Promise.all(
      ids.map(async (id) => [id, await getNamaPengguna(id)] as const),
    ).then((entries) => {
      if (!aktif) return;
      setNamaAsisten(
        Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))),
      );
    });

    return () => {
      aktif = false;
    };
  }, [asistenKey]);

  const retry = () => {
    setSessions(null);
    setClasses(null);
    setAttendances(null);
    setLeaves(null);
    setError('');
    setReloadKey((key) => key + 1);
  };

  if (!profile) return null;

  if (error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState message={error} onRetry={retry} />
      </View>
    );
  }

  if (!sessions || !classes || !attendances || !leaves) {
    return <LoadingState message="Memuat dashboard..." />;
  }

  const hariIni = tanggalHariIni();
  const upcoming = sessions.filter(
    (session) => session.status !== 'ditutup' && session.tanggal >= hariIni,
  );
  const nearest = upcoming[0] ?? null;
  const jadwalTerdekat = upcoming.slice(0, 3);

  const sesiLampau = sessions.filter(
    (session) => session.status === 'ditutup' || session.tanggal < hariIni,
  );
  const sesiHadir = new Set(attendances.map((attendance) => attendance.sessionId));
  const jumlahHadir = sesiLampau.filter((session) => sesiHadir.has(session.id)).length;
  const persentaseHadir = sesiLampau.length
    ? Math.round((jumlahHadir / sesiLampau.length) * 100)
    : 0;
  const izinDiproses = leaves.filter((leave) => leave.status === STATUS_IZIN.MENUNGGU).length;

  const subjudulHero = nearest
    ? `${nearest.praktikum} • ${labelWaktu(nearest)}`
    : 'Belum ada jadwal aktif saat ini.';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{inisial(profile.nama)}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.greeting} numberOfLines={1}>
            {sapaan()}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {profile.nama}
          </Text>
        </View>
        <ProfileButton />
        <LogoutButton />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCircleLarge} />
        <View style={styles.heroCircleSmall} />
        <Text style={styles.heroDate}>{labelHariIni()}</Text>
        <Text style={styles.heroTitle}>Siap untuk praktikum hari ini?</Text>
        <Text style={styles.heroSubtitle}>{subjudulHero}</Text>
        {nearest ? (
          <Pressable
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
            onPress={() => router.push(`/session/${nearest.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Lihat detail ${nearest.praktikum}`}
          >
            <Text style={styles.heroButtonText}>Lihat detail jadwal</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.attendanceRing}>
          <Text style={styles.attendanceValue}>{persentaseHadir}%</Text>
          <Text style={styles.attendanceLabel}>Hadir</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetrics}>
          <View style={styles.metricRow}>
            <View style={styles.metricIcon}>
              <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{upcoming.length}</Text>
              <Text style={styles.metricLabel}>Jadwal aktif</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricIcon}>
              <Ionicons name="document-text-outline" size={17} color={colors.primary} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{izinDiproses}</Text>
              <Text style={styles.metricLabel}>Izin diproses</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Jadwal terdekat</Text>
        <Pressable
          onPress={() => router.push('/praktikan/jadwal')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Lihat semua jadwal"
        >
          <Text style={styles.sectionLink}>Lihat semua</Text>
        </Pressable>
      </View>

      {jadwalTerdekat.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada jadwal terdekat</Text>
          <Text style={styles.emptyText}>
            Jadwal praktikum yang aktif akan muncul di sini.
          </Text>
          <PrimaryButton
            label="Buka Jadwal"
            size="sm"
            onPress={() => router.push('/praktikan/jadwal')}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <View style={styles.scheduleList}>
          {jadwalTerdekat.map((session) => {
            const tanggal = bagianTanggal(session.tanggal);
            return (
              <Pressable
                key={session.id}
                style={({ pressed }) => [styles.scheduleCard, pressed && styles.scheduleCardPressed]}
                onPress={() => router.push(`/session/${session.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${session.praktikum}, ${formatTanggal(`${session.tanggal}T00:00:00`)}`}
              >
                <View style={styles.dateColumn}>
                  <Text style={styles.dateDay}>{tanggal.hari}</Text>
                  <Text style={styles.dateNumber}>{tanggal.angka}</Text>
                  <Text style={styles.dateMonth}>{tanggal.bulan}</Text>
                </View>
                <View style={styles.scheduleDivider} />
                <View style={styles.scheduleBody}>
                  <Text style={styles.scheduleTitle} numberOfLines={1}>
                    {session.praktikum}
                  </Text>
                  <Text style={styles.scheduleMeta} numberOfLines={1}>
                    {labelWaktu(session)} • {session.ruangan}
                  </Text>
                  <Text style={styles.scheduleAssistant} numberOfLines={1}>
                    {namaAsisten[session.asistenId] || 'Asisten praktikum'}
                  </Text>
                </View>
                <View style={styles.chevron}>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 120, gap: 18 },
  stateWrap: { flex: 1, backgroundColor: colors.bg },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  avatarText: { fontSize: 16, fontFamily: font.extraBold, color: colors.primary },
  profileText: { flex: 1, gap: 2 },
  greeting: { ...text.caption, fontFamily: font.medium },
  name: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: font.extraBold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  hero: {
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderRadius: 26,
    padding: 22,
    paddingTop: 24,
    gap: 7,
  },
  heroCircleLarge: {
    position: 'absolute',
    right: -54,
    top: -58,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 24,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  heroCircleSmall: {
    position: 'absolute',
    right: 54,
    bottom: -36,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDate: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: font.bold,
    color: 'rgba(255,255,255,0.70)',
  },
  heroTitle: {
    maxWidth: 250,
    fontSize: 23,
    lineHeight: 29,
    fontFamily: font.extraBold,
    color: colors.white,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    maxWidth: 250,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.medium,
    color: 'rgba(255,255,255,0.78)',
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  heroButtonText: { fontSize: 12, fontFamily: font.bold, color: colors.primary },
  pressed: { opacity: 0.82 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  attendanceRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 7,
    borderColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  attendanceValue: { fontSize: 19, fontFamily: font.extraBold, color: colors.primary },
  attendanceLabel: { fontSize: 10, fontFamily: font.medium, color: colors.textSecondary },
  summaryDivider: { width: 1, height: 68, backgroundColor: colors.border },
  summaryMetrics: { flex: 1, gap: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  metricText: { gap: 1 },
  metricValue: { fontSize: 16, fontFamily: font.extraBold, color: colors.text },
  metricLabel: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: { ...text.sectionTitle },
  sectionLink: { fontSize: 12, fontFamily: font.bold, color: colors.primary },
  scheduleList: { gap: 10 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 13,
  },
  scheduleCardPressed: { backgroundColor: colors.surface, opacity: 0.9 },
  dateColumn: {
    width: 48,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  dateDay: { fontSize: 9, letterSpacing: 0.7, fontFamily: font.bold, color: colors.textSecondary },
  dateNumber: { fontSize: 20, lineHeight: 24, fontFamily: font.extraBold, color: colors.text },
  dateMonth: { fontSize: 9, letterSpacing: 0.7, fontFamily: font.bold, color: colors.textSecondary },
  scheduleDivider: {
    width: 3,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  scheduleBody: { flex: 1, gap: 2 },
  scheduleTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  scheduleMeta: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  scheduleAssistant: { fontSize: 11, fontFamily: font.semibold, color: colors.primary },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 22,
    padding: 24,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  emptyButton: { alignSelf: 'center', minHeight: 44, marginTop: 4 },
});
