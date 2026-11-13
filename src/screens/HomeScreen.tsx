// Dashboard utama praktikan: ringkasan kehadiran, izin, dan jadwal terdekat.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Attendance, ClassDoc, LeaveRequest, Session } from '../app/types';
import { STATUS_IZIN } from '../app/constants';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileRow}>
        <View style={styles.profileText}>
          <Text style={styles.greeting}>
            {sapaan()}, {profile.role}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {profile.nama}
          </Text>
        </View>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{inisial(profile.nama)}</Text>
          </View>
          <View style={styles.notificationDot} />
        </View>
      </View>

      <View style={styles.hero}>
        <Ionicons
          name="sparkles"
          size={94}
          color="rgba(255,255,255,0.13)"
          style={styles.heroSparkleLarge}
        />
        <Ionicons
          name="star"
          size={26}
          color="rgba(255,255,255,0.22)"
          style={styles.heroSparkleSmall}
        />
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
            <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.statValue}>{persentaseHadir}%</Text>
          <Text style={styles.statLabel}>Kehadiran</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={20} color="#5856D6" />
          <Text style={styles.statValue}>{upcoming.length}</Text>
          <Text style={styles.statLabel}>Jadwal aktif</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={20} color={COLORS.warning} />
          <Text style={styles.statValue}>{izinDiproses}</Text>
          <Text style={styles.statLabel}>Izin diproses</Text>
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
            <Ionicons name="calendar-outline" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada jadwal terdekat</Text>
          <Text style={styles.emptyText}>
            Jadwal praktikum yang aktif akan muncul di sini.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            onPress={() => router.push('/praktikan/jadwal')}
          >
            <Text style={styles.emptyButtonText}>Buka Jadwal</Text>
          </Pressable>
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
                <Ionicons name="chevron-forward" size={17} color={COLORS.muted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 18, paddingBottom: 36, gap: 18 },
  stateWrap: { flex: 1, backgroundColor: COLORS.background },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  profileText: { flex: 1, gap: 3 },
  greeting: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.muted,
  },
  name: {
    fontSize: 25,
    lineHeight: 31,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  avatarWrap: { width: 56, height: 56 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.primary,
  },
  notificationDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  hero: {
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    borderRadius: 26,
    padding: 22,
    paddingTop: 24,
    gap: 7,
  },
  heroSparkleLarge: { position: 'absolute', right: -18, top: 4 },
  heroSparkleSmall: { position: 'absolute', right: 66, top: 84 },
  heroDate: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.74)',
  },
  heroTitle: {
    maxWidth: 250,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.white,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    maxWidth: 250,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.82)',
  },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  heroButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.primary,
  },
  pressed: { opacity: 0.82 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 13,
    gap: 5,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.muted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  sectionLink: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.primary,
  },
  scheduleList: { gap: 10 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 13,
  },
  scheduleCardPressed: { backgroundColor: COLORS.surface, opacity: 0.88 },
  dateColumn: { width: 42, alignItems: 'center', gap: 1 },
  dateDay: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.muted,
  },
  dateNumber: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
  },
  dateMonth: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.muted,
  },
  scheduleDivider: {
    width: 4,
    height: 42,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  scheduleBody: { flex: 1, gap: 2 },
  scheduleTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  scheduleMeta: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  scheduleAssistant: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderLight,
    borderRadius: 20,
    padding: 24,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  emptyButton: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  emptyButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
  },
});
