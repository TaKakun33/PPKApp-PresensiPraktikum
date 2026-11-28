// Dashboard utama asisten: hero sesi aktif/terdekat, pintasan 3 fitur sejajar,
// serta daftar sesi yang diampu dengan kartu model tanggal seperti Home praktikan.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import type { ClassDoc, Session } from '../lib/types';
import LogoutButton from '../navigation/LogoutButton';
import NotificationButton from '../navigation/NotificationButton';
import ProfileButton from '../navigation/ProfileButton';
import TemaButton from '../navigation/TemaButton';
import { labelKelas, pesanFirestore, subscribeClassesForUser } from '../services/classService';
import { hariIniWib } from '../services/jadwalService';
import {
  labelTanggal,
  labelWaktu,
  sesiLupaDitutup,
  subscribeSessions,
  urutkanSesi,
} from '../services/sessionService';
import { formatTanggal } from '../utils/format';
import { kelompokkanSesi, type KelompokSesi } from '../utils/kelompokSesi';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const BATAS_AKAN_DATANG = 3;
const BATAS_SELESAI = 2;
const PADDING_VERTIKAL_SCROLL = 2;
const TINGGI_AWAL_AKAN_DATANG = 266;
const TINGGI_AWAL_SELESAI = 172;

const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
const HARI_SINGKAT = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
const BULAN_SINGKAT = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];

function parseTanggal(tanggal: string): Date | null {
  const date = new Date(`${tanggal}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function labelHariIni(tanggalWib: string): string {
  const date = parseTanggal(tanggalWib) ?? new Date();
  return `${HARI[date.getDay()]}, ${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}`;
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

function labelStatusSingkat(session: Session): { teks: string; aktif: boolean } {
  if (session.status === 'ditutup' || sesiLupaDitutup(session)) {
    return { teks: 'Ditutup', aktif: false };
  }
  if (session.status === 'dibuka') {
    return { teks: 'Dibuka', aktif: true };
  }
  return { teks: 'Belum dibuka', aktif: false };
}

function FeatureAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.featureCard, pressed && styles.featureCardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.featureIconWrap, primary && styles.featureIconPrimary]}>
        <Ionicons name={icon} size={18} color={primary ? colors.onPrimary : colors.text} />
      </View>
      <Text style={styles.featureLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AsistenHomeScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tampilSelesai, setTampilSelesai] = useState(false);
  const [tinggiAkanDatang, setTinggiAkanDatang] = useState<number | null>(null);
  const [tinggiSelesai, setTinggiSelesai] = useState<number | null>(null);
  // Detak per menit: kelompok "Hari ini" / "Sudah ditutup" ikut berubah sendiri (mis. lewat tengah malam WIB).
  const [, setDetak] = useState(0);

  const ukurKartuKetiga = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // Tambah ruang bawah setara padding vertikal agar border bawah kartu ke-3 utuh dan kartu ke-4 tetap tersembunyi di balik gap.
    const tinggiPas = Math.ceil(y + height) + PADDING_VERTIKAL_SCROLL;
    setTinggiAkanDatang((prev) => (prev === tinggiPas ? prev : tinggiPas));
  }, []);

  const ukurKartuKeduaSelesai = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // Tambah ruang bawah setara padding vertikal agar border bawah kartu ke-2 utuh dan kartu ke-3 tetap tersembunyi di balik gap.
    const tinggiPas = Math.ceil(y + height) + PADDING_VERTIKAL_SCROLL;
    setTinggiSelesai((prev) => (prev === tinggiPas ? prev : tinggiPas));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDetak((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) return;

    const unsubSessions = subscribeSessions(
      profile,
      (data) => {
        setSessions(urutkanSesi(data));
        setError(null);
      },
      (e) => setError(pesanFirestore(e, 'Gagal memuat jadwal. Coba lagi.')),
    );
    const unsubClasses = subscribeClassesForUser(
      profile,
      setClasses,
      () => setClasses([]),
    );

    return () => {
      unsubSessions();
      unsubClasses();
    };
  }, [profile, retryKey]);

  const kelasNama = useMemo(
    () => Object.fromEntries((classes ?? []).map((c) => [c.id, labelKelas(c)])),
    [classes],
  );

  if (!profile) return <Redirect href="/" />;

  if (error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setSessions(null);
            setClasses(null);
            setRetryKey((k) => k + 1);
          }}
        />
      </View>
    );
  }

  if (sessions === null || classes === null) {
    return <LoadingState message="Memuat dashboard..." />;
  }

  // Jadwal berkelompok (WIB). Sesi "Sedang dibuka" cukup tampil di kartu Hero atas,
  // tidak diulang di daftar bawah.
  const kelompok = kelompokkanSesi(sessions);
  const sesiMendatang = kelompok
    .filter((k) => ['hariIni', 'akanDatang'].includes(k.key))
    .flatMap((k) => k.data);
  const kelompokSelesai = kelompok.filter((k) => ['terlewat', 'ditutup'].includes(k.key));
  const jumlahSelesai = kelompokSelesai.reduce((total, k) => total + k.data.length, 0);

  const hariIni = hariIniWib();
  const sesiDibuka = kelompok.find((k) => k.key === 'dibuka')?.data[0] ?? null;
  const sesiHariIni = kelompok.find((k) => k.key === 'hariIni')?.data[0] ?? null;
  const sesiAkanDatang = kelompok.find((k) => k.key === 'akanDatang')?.data[0] ?? null;
  const nearest = sesiDibuka ?? sesiHariIni ?? sesiAkanDatang ?? null;
  const adaSesiSelesaiHariIni = kelompokSelesai.some((k) =>
    k.data.some((s) => s.tanggal === hariIni),
  );

  const judulHero = sesiDibuka
    ? 'Praktikum sedang berlangsung'
    : sesiHariIni
      ? 'Siap mengajar praktikum hari ini?'
      : sesiAkanDatang
        ? 'Sesi akan datang terdekat'
        : adaSesiSelesaiHariIni
          ? 'Sesi hari ini sudah selesai'
          : 'Belum ada jadwal mengajar';

  const subjudulHero = sesiDibuka
    ? `${sesiDibuka.praktikum} (${kelasNama[sesiDibuka.kelasId] || 'Kelas'}) • ${labelWaktu(sesiDibuka)}`
    : sesiHariIni
      ? `${sesiHariIni.praktikum} (${kelasNama[sesiHariIni.kelasId] || 'Kelas'}) • ${labelWaktu(sesiHariIni)}`
      : sesiAkanDatang
        ? `${sesiAkanDatang.praktikum} (${kelasNama[sesiAkanDatang.kelasId] || 'Kelas'}) • ${labelTanggal(sesiAkanDatang.tanggal)}, ${labelWaktu(sesiAkanDatang)}`
        : 'Belum ada jadwal sesi akan datang saat ini.';

  const renderKartu = (session: Session, onLayout?: (event: LayoutChangeEvent) => void) => {
    const tanggal = bagianTanggal(session.tanggal);
    const kelas = kelasNama[session.kelasId] || 'Kelas';
    const statusInfo = labelStatusSingkat(session);

    return (
      <Pressable
        key={session.id}
        onLayout={onLayout}
        style={({ pressed }) => [styles.scheduleCard, pressed && styles.scheduleCardPressed]}
        onPress={() => router.push(`/session/${session.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${session.praktikum}, ${kelas}, ${formatTanggal(`${session.tanggal}T00:00:00`)}`}
      >
        <View style={styles.dateColumn}>
          <Text style={styles.dateDay}>{tanggal.hari}</Text>
          <Text style={styles.dateNumber}>{tanggal.angka}</Text>
          <Text style={styles.dateMonth}>{tanggal.bulan}</Text>
        </View>
        <View style={[styles.scheduleDivider, statusInfo.aktif && styles.scheduleDividerActive]} />
        <View style={styles.scheduleBody}>
          <Text style={styles.scheduleTitle} numberOfLines={1}>
            {session.praktikum}
          </Text>
          <Text style={styles.scheduleMeta} numberOfLines={1}>
            {labelWaktu(session)} • {session.ruangan}
          </Text>
          <Text style={styles.scheduleSub} numberOfLines={1}>
            {kelas} •{' '}
            <Text style={statusInfo.aktif ? styles.scheduleStatusActive : styles.scheduleStatusText}>
              {statusInfo.teks}
            </Text>
          </Text>
        </View>
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </View>
      </Pressable>
    );
  };

  const pakaiFixScrollMendatang = sesiMendatang.length > BATAS_AKAN_DATANG;

  const renderKelompokSelesai = (k: KelompokSesi) => {
    const pakaiFixScroll = k.data.length > BATAS_SELESAI;

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
            style={[
              styles.selesaiScroll,
              tinggiSelesai !== null && { maxHeight: tinggiSelesai },
            ]}
            contentContainerStyle={styles.akanDatangScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {k.data.map((session, index) =>
              renderKartu(session, index === BATAS_SELESAI - 1 ? ukurKartuKeduaSelesai : undefined),
            )}
          </ScrollView>
        ) : (
          <View style={styles.scheduleList}>{k.data.map((session) => renderKartu(session))}</View>
        )}
      </View>
    );
  };

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
        <Text style={styles.heroDate}>{labelHariIni(hariIni)}</Text>
        <Text style={styles.heroTitle}>{judulHero}</Text>
        <Text style={styles.heroSubtitle}>{subjudulHero}</Text>
        {nearest ? (
          <Pressable
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
            onPress={() => router.push(`/session/${nearest.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Lihat detail ${nearest.praktikum}`}
          >
            <Text style={styles.heroButtonText}>Lihat detail sesi</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.onHighlight} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
            onPress={() => router.push('/session-form')}
            accessibilityRole="button"
            accessibilityLabel="Tambah sesi baru"
          >
            <Ionicons name="add" size={16} color={colors.onHighlight} />
            <Text style={styles.heroButtonText}>Tambah sesi baru</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.featureRow}>
        <FeatureAction
          icon="add"
          label="Tambah Sesi"
          primary
          onPress={() => router.push('/session-form')}
        />
        <FeatureAction
          icon="people-outline"
          label="Kelola Kelas"
          onPress={() => router.push('/kelas')}
        />
        <FeatureAction
          icon="location-outline"
          label="Lokasi Lab"
          onPress={() => router.push('/lab-lokasi')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sesi yang akan datang</Text>
        <View style={styles.sectionCountBadge}>
          <Text style={styles.sectionCountText}>{sesiMendatang.length}</Text>
        </View>
      </View>

      {kelompok.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={26} color={colors.text} />
          </View>
          <Text style={styles.emptyTitle}>Belum ada jadwal</Text>
          <Text style={styles.emptyText}>
            {classes.length === 0
              ? 'Kamu belum mengampu kelas mana pun. Buat kelas terlebih dahulu di menu Kelola Kelas.'
              : 'Belum ada sesi praktikum. Tekan Tambah Sesi di atas untuk membuat jadwal.'}
          </Text>
        </View>
      ) : (
        <>
          {sesiMendatang.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Tidak ada jadwal mendatang</Text>
              <Text style={styles.emptyText}>
                {sesiDibuka
                  ? 'Sesi yang sedang dibuka ditampilkan pada kartu utama di atas.'
                  : 'Belum ada sesi untuk hari ini atau yang akan datang.'}
              </Text>
            </View>
          ) : pakaiFixScrollMendatang ? (
            <ScrollView
              style={[
                styles.akanDatangScroll,
                tinggiAkanDatang !== null && { maxHeight: tinggiAkanDatang },
              ]}
              contentContainerStyle={styles.akanDatangScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {sesiMendatang.map((session, index) =>
                renderKartu(session, index === BATAS_AKAN_DATANG - 1 ? ukurKartuKetiga : undefined),
              )}
            </ScrollView>
          ) : (
            <View style={styles.scheduleList}>
              {sesiMendatang.map((session) => renderKartu(session))}
            </View>
          )}

          {jumlahSelesai > 0 ? (
            <>
              <Pressable
                onPress={() => setTampilSelesai((v) => !v)}
                style={({ pressed }) => [styles.toggleLinkRow, pressed && styles.pressed]}
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
              {tampilSelesai ? (
                <View style={styles.selesaiWrap}>
                  {kelompokSelesai.map(renderKelompokSelesai)}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 96,
    gap: 12,
  },
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
    borderRadius: 22,
    paddingVertical: 15,
    paddingHorizontal: 18,
    gap: 4,
  },
  heroCircleLarge: {
    position: 'absolute',
    right: -54,
    top: -58,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 22,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  heroCircleSmall: {
    position: 'absolute',
    right: 48,
    bottom: -34,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDate: {
    fontSize: 9.5,
    letterSpacing: 1,
    fontFamily: font.bold,
    color: 'rgba(255,255,255,0.70)',
  },
  heroTitle: {
    maxWidth: 270,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: font.extraBold,
    color: colors.onSecondary,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    maxWidth: 270,
    fontSize: 12,
    lineHeight: 17,
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
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginTop: 5,
  },
  heroButtonText: { fontSize: 11.5, fontFamily: font.bold, color: colors.onHighlight },
  pressed: { opacity: 0.82 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  featureCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureCardPressed: { backgroundColor: colors.surface, opacity: 0.9 },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  featureIconPrimary: {
    backgroundColor: colors.primary,
  },
  featureLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: font.bold,
    color: colors.text,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { ...text.sectionTitle, fontSize: 15 },
  sectionCountBadge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.tint,
  },
  sectionCountText: { fontSize: 11.5, fontFamily: font.bold, color: colors.secondaryText },
  sectionLink: { fontSize: 12, fontFamily: font.bold, color: colors.primaryText },
  scheduleList: { gap: 8 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scheduleCardPressed: { backgroundColor: colors.surface, opacity: 0.9 },
  dateColumn: {
    width: 44,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  dateDay: { fontSize: 8.5, letterSpacing: 0.6, fontFamily: font.bold, color: colors.textSecondary },
  dateNumber: { fontSize: 18, lineHeight: 21, fontFamily: font.extraBold, color: colors.text },
  dateMonth: { fontSize: 8.5, letterSpacing: 0.6, fontFamily: font.bold, color: colors.textSecondary },
  scheduleDivider: {
    width: 3,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
  scheduleDividerActive: {
    backgroundColor: colors.primary,
  },
  scheduleBody: { flex: 1, gap: 1 },
  scheduleTitle: { fontSize: 13.5, fontFamily: font.bold, color: colors.text },
  scheduleMeta: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  scheduleSub: { fontSize: 11, fontFamily: font.semibold, color: colors.secondaryText },
  scheduleStatusText: { fontFamily: font.medium, color: colors.textSecondary },
  scheduleStatusActive: { fontFamily: font.bold, color: colors.primaryText },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    borderRadius: 20,
    padding: 18,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
    marginBottom: 2,
  },
  emptyTitle: { fontSize: 13.5, fontFamily: font.bold, color: colors.text },
  emptyText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  kelompok: { gap: 8 },
  kelompokJudulBaris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kelompokJudul: { fontSize: 12.5, fontFamily: font.bold, color: colors.secondaryText },
  kelompokJumlah: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.tint,
  },
  kelompokJumlahTeks: { fontSize: 11, fontFamily: font.bold, color: colors.secondaryText },
  toggleLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  // Tinggi pas untuk menampilkan 3 kartu jadwal secara utuh (diukur dinamis lewat onLayout kartu ke-3).
  akanDatangScroll: {
    maxHeight: TINGGI_AWAL_AKAN_DATANG,
    flexGrow: 0,
  },
  akanDatangScrollContent: {
    gap: 8,
    paddingVertical: PADDING_VERTIKAL_SCROLL,
  },
  selesaiWrap: {
    gap: 10,
  },
  // Tinggi pas untuk menampilkan 2 kartu sesi selesai/ditutup secara utuh (diukur dinamis lewat onLayout kartu ke-2).
  selesaiScroll: {
    maxHeight: TINGGI_AWAL_SELESAI,
    flexGrow: 0,
  },
});
