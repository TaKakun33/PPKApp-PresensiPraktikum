// Dashboard utama praktikan: ringkasan kehadiran, izin, dan jadwal terdekat.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Attendance, ClassDoc, LeaveRequest, Session } from '../lib/types';
import { STATUS_IZIN } from '../lib/constants';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { colors, font, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../navigation/LogoutButton';
import NotificationButton from '../navigation/NotificationButton';
import ProfileButton from '../navigation/ProfileButton';
import TemaButton from '../navigation/TemaButton';
import { getNamaPengguna, subscribeClassesForUser } from '../services/classService';
import { subscribeAttendanceHistory, subscribeLeaveHistory } from '../services/historyService';
import { labelWaktu, subscribeSessions, urutkanSesi } from '../services/sessionService';
import { formatTanggal } from '../utils/format';
import { kelompokkanSesi, type KelompokSesi, type KunciKelompok } from '../utils/kelompokSesi';

const BATAS_AKAN_DATANG = 3;
const BATAS_SELESAI = 2;
const PADDING_VERTIKAL_SCROLL = 2;
const TINGGI_AWAL_AKAN_DATANG = 276;
const TINGGI_AWAL_SELESAI = 182;

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
  const [tampilSelesai, setTampilSelesai] = useState(false);
  const [tinggiKelompok, setTinggiKelompok] = useState<Partial<Record<KunciKelompok, number>>>({});

  const ukurBatasKelompok = useCallback((key: KunciKelompok, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const tinggiPas = Math.ceil(y + height) + PADDING_VERTIKAL_SCROLL;
    setTinggiKelompok((prev) => (prev[key] === tinggiPas ? prev : { ...prev, [key]: tinggiPas }));
  }, []);

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

  // Jadwal lengkap berkelompok (WIB). Sesi selesai / terlewat dilipat supaya Home tidak panjang.
  const kelompok = kelompokkanSesi(sessions);
  const kelompokAktif = kelompok.filter((k) => ['dibuka', 'hariIni', 'akanDatang'].includes(k.key));
  const kelompokSelesai = kelompok.filter((k) => ['terlewat', 'ditutup'].includes(k.key));
  const jumlahSelesai = kelompokSelesai.reduce((total, k) => total + k.data.length, 0);

  const renderKartu = (session: Session, onLayout?: (event: LayoutChangeEvent) => void) => {
    const tanggal = bagianTanggal(session.tanggal);
    return (
      <Pressable
        key={session.id}
        onLayout={onLayout}
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
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </View>
      </Pressable>
    );
  };

  const renderKelompok = (k: KelompokSesi) => {
    const selesai = k.key === 'terlewat' || k.key === 'ditutup';
    const batas = selesai ? BATAS_SELESAI : BATAS_AKAN_DATANG;
    const pakaiFixScroll = k.data.length > batas;
    const maxHeight =
      tinggiKelompok[k.key] ?? (selesai ? TINGGI_AWAL_SELESAI : TINGGI_AWAL_AKAN_DATANG);

    return (
      <View key={k.key} style={styles.kelompok}>
        <View style={styles.kelompokJudulBaris}>
          <Text style={styles.kelompokJudul}>{k.judul}</Text>
          <View style={styles.kelompokJumlah}>
            <Text style={styles.kelompokJumlahTeks}>{k.data.length}</Text>
          </View>
        </View>
        {pakaiFixScroll ? (
          <ScrollView
            style={[styles.fixScroll, { maxHeight }]}
            contentContainerStyle={styles.fixScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {k.data.map((session, index) =>
              renderKartu(
                session,
                index === batas - 1 ? (event) => ukurBatasKelompok(k.key, event) : undefined,
              ),
            )}
          </ScrollView>
        ) : (
          <View style={styles.scheduleList}>{k.data.map((session) => renderKartu(session))}</View>
        )}
      </View>
    );
  };

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
      nestedScrollEnabled
    >
      <View style={styles.profileRow}>
        <ProfileButton size={46} />
        <View style={styles.profileText}>
          <Text style={styles.greeting} numberOfLines={1}>
            {sapaan()}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {profile.nama}
          </Text>
        </View>
        <NotificationButton />
        <TemaButton />
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
            <Ionicons name="arrow-forward" size={15} color={colors.onHighlight} />
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
              <Ionicons name="calendar-outline" size={17} color={colors.text} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{upcoming.length}</Text>
              <Text style={styles.metricLabel}>Jadwal aktif</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricIcon}>
              <Ionicons name="document-text-outline" size={17} color={colors.text} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{izinDiproses}</Text>
              <Text style={styles.metricLabel}>Izin diproses</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Jadwal praktikum</Text>
      </View>

      {kelompok.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={26} color={colors.text} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada jadwal</Text>
          <Text style={styles.emptyText}>
            {(profile.kelasIds ?? []).length === 0
              ? 'Kamu belum terdaftar di kelas mana pun. Hubungi asisten praktikum.'
              : 'Jadwal praktikum kelasmu akan muncul di sini.'}
          </Text>
        </View>
      ) : (
        <>
          {kelompokAktif.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Tidak ada jadwal aktif</Text>
              <Text style={styles.emptyText}>Belum ada sesi yang dibuka atau akan datang.</Text>
            </View>
          ) : (
            kelompokAktif.map(renderKelompok)
          )}

          {jumlahSelesai > 0 ? (
            <>
              <Pressable
                onPress={() => setTampilSelesai((v) => !v)}
                style={({ pressed }) => [styles.toggleSelesai, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: tampilSelesai }}
                accessibilityLabel={tampilSelesai ? 'Sembunyikan sesi selesai' : 'Tampilkan sesi selesai'}
              >
                <Text style={styles.sectionLink}>
                  {tampilSelesai ? 'Sembunyikan sesi selesai' : `Tampilkan sesi selesai (${jumlahSelesai})`}
                </Text>
                <Ionicons
                  name={tampilSelesai ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.primaryText}
                />
              </Pressable>
              {tampilSelesai ? kelompokSelesai.map(renderKelompok) : null}
            </>
          ) : null}
        </>
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
    backgroundColor: colors.secondary,
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
    color: colors.onSecondary,
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
    backgroundColor: colors.highlightOnBrand,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  heroButtonText: { fontSize: 12, fontFamily: font.bold, color: colors.onHighlight },
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
  attendanceValue: { fontSize: 19, fontFamily: font.extraBold, color: colors.secondaryText },
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
  sectionLink: { fontSize: 12, fontFamily: font.bold, color: colors.primaryText },
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
    backgroundColor: colors.secondary,
  },
  scheduleBody: { flex: 1, gap: 2 },
  scheduleTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  scheduleMeta: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  scheduleAssistant: { fontSize: 11, fontFamily: font.semibold, color: colors.secondaryText },
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
  kelompok: { gap: 10 },
  kelompokJudulBaris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kelompokJudul: { fontSize: 13, fontFamily: font.bold, color: colors.secondaryText },
  kelompokJumlah: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.tint,
  },
  kelompokJumlahTeks: { fontSize: 11, fontFamily: font.bold, color: colors.secondaryText },
  toggleSelesai: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  fixScroll: {
    flexGrow: 0,
  },
  fixScrollContent: {
    gap: 10,
    paddingVertical: PADDING_VERTIKAL_SCROLL,
  },
});
