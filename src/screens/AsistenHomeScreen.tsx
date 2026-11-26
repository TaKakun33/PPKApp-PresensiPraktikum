// Home asisten: isi daftar sama seperti layar Jadwal asisten sebelumnya (sesi yang diampu, dikelompokkan
// menurut status, plus tombol Tambah Sesi / Kelola Kelas / Kelola Lokasi Lab). Bagian atas memakai
// baris profil seperti Home praktikan (profil, sapaan, notifikasi, tema, keluar).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import KelompokHeader from '../components/KelompokHeader';
import LoadingState from '../components/LoadingState';
import SessionCard from '../components/SessionCard';
import type { Session } from '../lib/types';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../navigation/LogoutButton';
import NotificationButton from '../navigation/NotificationButton';
import ProfileButton from '../navigation/ProfileButton';
import TemaButton from '../navigation/TemaButton';
import { labelKelas, pesanFirestore, subscribeClassesForUser } from '../services/classService';
import { subscribeSessions, urutkanSesi } from '../services/sessionService';
import { kelompokkanSesi } from '../utils/kelompokSesi';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function sapaan(): string {
  const jam = new Date().getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function HeaderButton({ icon, label, onPress, primary }: { icon: IoniconsName; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, primary && styles.headerButtonPrimary, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.onPrimary : colors.text} />
      <Text style={[styles.headerButtonText, primary && styles.headerButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export default function AsistenHomeScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [kelasNama, setKelasNama] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  // Detak per menit: kelompok "Hari ini" / "Sudah ditutup" ikut berubah sendiri (mis. lewat tengah malam WIB).
  const [, setDetak] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setDetak((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) return;
    return subscribeSessions(
      profile,
      (data) => {
        setSessions(urutkanSesi(data));
        setError(null);
      },
      (e) => setError(pesanFirestore(e, 'Gagal memuat jadwal. Coba lagi.')),
    );
  }, [profile, retryKey]);

  // Nama kelas hanya pelengkap tampilan; kalau gagal dimuat, kartu memakai kelasId.
  useEffect(() => {
    if (!profile) return;
    return subscribeClassesForUser(
      profile,
      (data) => setKelasNama(Object.fromEntries(data.map((c) => [c.id, labelKelas(c)]))),
      () => setKelasNama({}),
    );
  }, [profile, retryKey]);

  if (!profile) return <Redirect href="/" />;

  if (error) {
    return (
      <View style={styles.screen}>
        <View style={styles.state}>
          <ErrorState
            message={error}
            onRetry={() => {
              setError(null);
              setSessions(null);
              setRetryKey((k) => k + 1);
            }}
          />
        </View>
      </View>
    );
  }
  if (sessions === null) {
    return (
      <View style={styles.screen}>
        <View style={styles.state}>
          <LoadingState message="Memuat jadwal..." />
        </View>
      </View>
    );
  }

  const kelompok = kelompokkanSesi(sessions);

  return (
    <View style={styles.screen}>
      <SectionList
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        sections={kelompok}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <KelompokHeader judul={section.judul} keterangan={section.keterangan} jumlah={section.data.length} />
        )}
        SectionSeparatorComponent={() => null}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            kelasNama={kelasNama[item.kelasId]}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
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

            <Text style={styles.title}>Sesi yang Kamu Ampu</Text>
            <Text style={styles.subtitle}>
              {sessions.length > 0
                ? `${sessions.length} sesi, dikelompokkan menurut status. Tekan kartu untuk melihat detail.`
                : 'Belum ada sesi.'}
            </Text>
            <View style={styles.headerActions}>
              <HeaderButton icon="add" label="Tambah Sesi" primary onPress={() => router.push('/session-form')} />
              <HeaderButton icon="people-outline" label="Kelola Kelas" onPress={() => router.push('/kelas')} />
              <HeaderButton icon="location-outline" label="Kelola Lokasi Lab" onPress={() => router.push('/lab-lokasi')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="Belum ada jadwal"
            message="Kamu belum punya sesi. Tekan Tambah Sesi untuk membuat jadwal."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  state: { flex: 1 },
  // flexGrow supaya EmptyState (flex: 1) bisa mengisi sisa layar.
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarSpace,
  },
  header: { gap: 6, marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  profileText: { flex: 1, gap: 2 },
  greeting: { ...text.caption, fontFamily: font.medium },
  name: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: font.extraBold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  title: { fontSize: 20, fontFamily: font.extraBold, color: colors.text },
  subtitle: { ...text.body, fontFamily: font.medium },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  headerButtonPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  headerButtonText: { fontSize: 12, fontFamily: font.bold, color: colors.secondaryText },
  headerButtonTextPrimary: { color: colors.onPrimary },
  pressed: { opacity: 0.8 },
  separator: { height: 12 },
});
