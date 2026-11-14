// Pemilik: Hadrian (feat/classsessioncrud), SRS-17.
// Daftar jadwal sesi real-time dari Firestore. Layar ini dipakai oleh DUA peran:
//   praktikan -> sesi di kelas yang diikuti (profile.kelasIds)
//   asisten   -> sesi yang diampu (asistenId), plus tombol Tambah Sesi dan Kelola Kelas
// Ada state loading, kosong, dan error (dengan tombol coba lagi).
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import ScreenHeader from '../components/ScreenHeader';
import SessionCard from '../components/SessionCard';
import type { Session } from '../lib/types';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { pesanFirestore, subscribeClassesForUser } from '../services/classService';
import { subscribeSessions, urutkanSesi } from '../services/sessionService';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function HeaderButton({ icon, label, onPress, primary }: { icon: IoniconsName; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, primary && styles.headerButtonPrimary, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={primary ? colors.white : colors.primary} />
      <Text style={[styles.headerButtonText, primary && styles.headerButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export default function ScheduleScreen() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [kelasNama, setKelasNama] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

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
      (data) => setKelasNama(Object.fromEntries(data.map((c) => [c.id, c.namaKelas]))),
      () => setKelasNama({}),
    );
  }, [profile, retryKey]);

  if (!profile) return <Redirect href="/" />;

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Jadwal" />
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
        <ScreenHeader title="Jadwal" />
        <View style={styles.state}>
          <LoadingState message="Memuat jadwal..." />
        </View>
      </View>
    );
  }

  const isAsisten = profile.role === 'asisten';
  const belumPunyaKelas = !isAsisten && (profile.kelasIds ?? []).length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Jadwal" />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}
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
            <View style={styles.roleChip}>
              <Ionicons name="person-circle-outline" size={15} color={colors.primary} />
              <Text style={styles.roleText} numberOfLines={1}>
                {profile.nama} ({isAsisten ? 'Asisten' : 'Praktikan'})
              </Text>
            </View>
            <Text style={styles.title}>{isAsisten ? 'Sesi yang Kamu Ampu' : 'Jadwal Praktikum'}</Text>
            <Text style={styles.subtitle}>
              {sessions.length > 0
                ? `${sessions.length} sesi, diperbarui otomatis. Tekan kartu untuk melihat detail.`
                : 'Belum ada sesi.'}
            </Text>
            {isAsisten ? (
              <View style={styles.headerActions}>
                <HeaderButton icon="add" label="Tambah Sesi" primary onPress={() => router.push('/session-form')} />
                <HeaderButton icon="people-outline" label="Kelola Kelas" onPress={() => router.push('/kelas')} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="Belum ada jadwal"
            message={
              isAsisten
                ? 'Kamu belum punya sesi. Tekan Tambah Sesi untuk membuat jadwal.'
                : belumPunyaKelas
                  ? 'Kamu belum terdaftar di kelas mana pun. Hubungi asisten praktikum.'
                  : 'Belum ada sesi praktikum untuk kelasmu.'
            }
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
    paddingTop: 8,
    paddingBottom: layout.tabBarSpace,
  },
  header: { gap: 6, marginBottom: 16 },
  roleChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
    marginBottom: 4,
  },
  roleText: { ...text.caption, color: colors.primary, fontFamily: font.semibold },
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
  headerButtonText: { fontSize: 12, fontFamily: font.bold, color: colors.primary },
  headerButtonTextPrimary: { color: colors.white },
  pressed: { opacity: 0.8 },
  separator: { height: 12 },
});
