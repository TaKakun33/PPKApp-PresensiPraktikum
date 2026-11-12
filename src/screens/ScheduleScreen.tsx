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
import SessionCard from '../components/SessionCard';
import type { Session } from '../app/types';
import { COLORS } from '../constants/colors';
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
      <Ionicons name={icon} size={16} color={primary ? COLORS.white : COLORS.text} />
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
      <View style={styles.list}>
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setSessions(null);
            setRetryKey((k) => k + 1);
          }}
        />
      </View>
    );
  }
  if (sessions === null) {
    return (
      <View style={styles.list}>
        <LoadingState message="Memuat jadwal..." />
      </View>
    );
  }

  const isAsisten = profile.role === 'asisten';
  const belumPunyaKelas = !isAsisten && (profile.kelasIds ?? []).length === 0;

  return (
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
          <Text style={styles.login} numberOfLines={1}>
            Login: {profile.nama} ({isAsisten ? 'Asisten' : 'Praktikan'})
          </Text>
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
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.background },
  // flexGrow supaya EmptyState (flex: 1) bisa mengisi sisa layar.
  content: { flexGrow: 1, padding: 20 },
  header: { gap: 4, marginBottom: 16 },
  login: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerButtonPrimary: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  headerButtonText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  headerButtonTextPrimary: { color: COLORS.white },
  pressed: { opacity: 0.8 },
  separator: { height: 12 },
});
