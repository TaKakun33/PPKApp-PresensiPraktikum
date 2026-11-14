// Pemilik: Hadrian (feat/classsessioncrud), SRS-18 (+ aksi ubah/hapus SRS-16).
// Detail satu sesi, ter-update real-time lewat listener Firestore (tanpa restart):
// praktikum, kelas, tanggal, waktu, ruangan, asisten, dan status.
// Di bawahnya ada kartu kehadiran: praktikan melihat status presensinya, asisten melihat jumlah hadir.
// Asisten pengampu bisa mengubah atau menghapus jadwal selama sesi Belum Dibuka.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import type { Role } from '../lib/constants';
import type { ClassDoc, Session } from '../lib/types';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getNamaPengguna, pesanFirestore, subscribeClass } from '../services/classService';
import {
  deleteSession,
  labelTanggal,
  labelWaktu,
  subscribeAttendances,
  subscribeMyAttendances,
  subscribeSession,
} from '../services/sessionService';
import { formatJam } from '../utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Warna kartu kehadiran, diambil dari warna bersama agar senada dengan StatusBadge.
const TONE = {
  success: { color: COLORS.success, bg: COLORS.successLight },
  info: { color: COLORS.primary, bg: COLORS.primaryLight },
  neutral: { color: COLORS.textSecondary, bg: COLORS.surface },
  danger: { color: COLORS.danger, bg: COLORS.dangerLight },
};

type Presence = { icon: IoniconsName; tone: keyof typeof TONE; title: string; message: string };
type Hadir = { ada: boolean; waktu: Date | null };
type Muat = { status: 'loading' } | { status: 'ok'; session: Session | null } | { status: 'error'; message: string };
// openedAt/closedAt diisi serverTimestamp() oleh service buka/tutup sesi.
type SessionWaktu = Session & { openedAt?: unknown; closedAt?: unknown };
// Skema presensi belum final: service PM memakai waktuHadir, attendanceService Damar memakai checkedInAt.
type AttendanceWaktu = { waktuHadir?: unknown; checkedInAt?: unknown };

// Firestore Timestamp / string ISO -> Date. Nilai lain (mis. serverTimestamp yang belum selesai) -> null.
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  const ts = value as { toDate?: () => Date };
  return typeof ts.toDate === 'function' ? ts.toDate() : null;
}

const jam = (d: Date) => formatJam(d.toISOString());

// Isi kartu kehadiran sesuai peran dan status sesi.
// milikSaya = sesi ada di kelas praktikan / diampu asisten.
function describePresence(
  session: Session,
  role: Role,
  milikSaya: boolean,
  hadir: Hadir,
  jumlahHadir: number | null,
): Presence {
  if (!milikSaya) {
    return {
      icon: 'information-circle-outline',
      tone: 'neutral',
      title: role === 'asisten' ? 'Bukan sesi yang kamu ampu' : 'Bukan sesi kelasmu',
      message:
        role === 'asisten'
          ? 'Sesi ini diampu asisten lain, jadi kamu tidak dapat membuka atau menutupnya.'
          : 'Kamu tidak terdaftar di kelas ini, jadi tidak dapat presensi di sesi ini.',
    };
  }
  if (role === 'asisten') {
    if (session.status === 'belum_dibuka') {
      return {
        icon: 'lock-closed-outline',
        tone: 'neutral',
        title: 'Sesi belum dibuka',
        message: 'Rekap kehadiran tersedia setelah sesi dibuka.',
      };
    }
    return {
      icon: 'people-outline',
      tone: session.status === 'dibuka' ? 'success' : 'neutral',
      title: jumlahHadir === null ? 'Jumlah hadir belum tersedia' : `${jumlahHadir} praktikan hadir`,
      message:
        session.status === 'dibuka'
          ? 'Sesi masih dibuka, jumlah hadir bertambah otomatis.'
          : 'Sesi sudah ditutup. Daftar lengkap ada di tab Rekap.',
    };
  }
  if (hadir.ada) {
    return {
      icon: 'checkmark-circle-outline',
      tone: 'success',
      title: 'Kamu sudah presensi',
      message: hadir.waktu ? `Tercatat pukul ${jam(hadir.waktu)}.` : 'Waktu hadir sedang dicatat server.',
    };
  }
  if (session.status === 'belum_dibuka') {
    return {
      icon: 'time-outline',
      tone: 'neutral',
      title: 'Sesi belum dibuka',
      message: 'Presensi bisa dilakukan setelah asisten membuka sesi.',
    };
  }
  if (session.status === 'dibuka') {
    return {
      icon: 'radio-button-on-outline',
      tone: 'info',
      title: 'Presensi sedang dibuka',
      message: 'Lakukan presensi lewat tab Presensi.',
    };
  }
  return {
    icon: 'close-circle-outline',
    tone: 'danger',
    title: 'Sesi sudah ditutup',
    message: 'Kamu tidak tercatat hadir di sesi ini.',
  };
}

function InfoRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const uid = profile?.id;
  const role = profile?.role;

  const [muat, setMuat] = useState<Muat>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const [kelas, setKelas] = useState<ClassDoc | null>(null);
  const [namaAsistenLain, setNamaAsistenLain] = useState<string | null>(null);
  const [hadir, setHadir] = useState<Hadir>({ ada: false, waktu: null });
  const [jumlahHadir, setJumlahHadir] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Listener utama: setiap perubahan dokumen sesi langsung tampil.
  useEffect(() => {
    if (!id) return;
    return subscribeSession(
      id,
      (session) => setMuat({ status: 'ok', session }),
      (e) => setMuat({ status: 'error', message: pesanFirestore(e, 'Gagal memuat detail sesi.') }),
    );
  }, [id, retryKey]);

  const session = muat.status === 'ok' ? muat.session : null;
  const kelasId = session?.kelasId;
  const asistenId = session?.asistenId;
  const pengampu = role === 'asisten' && !!asistenId && asistenId === uid;

  useEffect(() => {
    if (!kelasId) return;
    return subscribeClass(kelasId, setKelas, () => setKelas(null));
  }, [kelasId]);

  // Nama asisten lain dibaca sekali; asisten pengampu memakai nama dari profilnya sendiri.
  useEffect(() => {
    if (!asistenId || asistenId === uid) return;
    let aktif = true;
    getNamaPengguna(asistenId).then((nama) => aktif && setNamaAsistenLain(nama));
    return () => {
      aktif = false;
    };
  }, [asistenId, uid]);

  // Kehadiran: praktikan -> presensinya sendiri, asisten pengampu -> jumlah hadir.
  useEffect(() => {
    if (!uid || !id) return;
    if (role === 'praktikan') {
      return subscribeMyAttendances(
        uid,
        (list) => {
          const att = list.find((a) => a.sessionId === id) as AttendanceWaktu | undefined;
          setHadir({ ada: !!att, waktu: toDate(att?.checkedInAt ?? att?.waktuHadir) });
        },
        () => setHadir({ ada: false, waktu: null }),
      );
    }
    if (pengampu) {
      return subscribeAttendances(
        id,
        (list) => setJumlahHadir(list.length),
        () => setJumlahHadir(null),
      );
    }
  }, [uid, role, id, pengampu]);

  if (!profile) return <Redirect href="/" />;

  const kembali = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (deleting) return <LoadingState message="Menghapus sesi..." />;
  if (muat.status === 'loading') return <LoadingState message="Memuat detail sesi..." />;
  if (muat.status === 'error') {
    return (
      <View style={styles.notFound}>
        <ErrorState
          message={muat.message}
          onRetry={() => {
            setMuat({ status: 'loading' });
            setRetryKey((k) => k + 1);
          }}
        />
      </View>
    );
  }
  if (!session) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Sesi tidak ditemukan"
          message={`Sesi dengan ID "${id ?? '-'}" tidak ada atau sudah dihapus.`}
        />
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={kembali}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  const milikSaya =
    profile.role === 'asisten' ? pengampu : (profile.kelasIds ?? []).includes(session.kelasId);
  const presence = describePresence(session, profile.role, milikSaya, hadir, jumlahHadir);
  const tone = TONE[presence.tone];
  const namaKelas = kelas?.namaKelas ?? session.kelasId;
  const namaAsisten = pengampu ? profile.nama : namaAsistenLain;
  const { openedAt, closedAt } = session as SessionWaktu;
  const dibuka = toDate(openedAt);
  const ditutup = toDate(closedAt);

  const hapus = () =>
    Alert.alert('Hapus sesi?', `${session.praktikum} (${namaKelas}, ${labelTanggal(session.tanggal)}) akan dihapus.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteSession(session.id, profile.id);
            kembali();
          } catch (e) {
            setDeleting(false);
            Alert.alert('Gagal menghapus', pesanFirestore(e, 'Gagal menghapus sesi.'));
          }
        },
      },
    ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <StatusBadge status={session.status} />
        <Text style={styles.title}>{session.praktikum}</Text>
        <Text style={styles.subtitle}>
          {namaKelas} · {labelTanggal(session.tanggal)}
        </Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="book-outline" label="Praktikum" value={session.praktikum} />
        <InfoRow icon="people-outline" label="Kelas" value={namaKelas} />
        <InfoRow icon="calendar-outline" label="Tanggal" value={labelTanggal(session.tanggal)} />
        <InfoRow icon="time-outline" label="Waktu" value={labelWaktu(session)} />
        <InfoRow icon="location-outline" label="Ruangan" value={session.ruangan} />
        <InfoRow icon="person-outline" label="Asisten" value={namaAsisten ?? 'Asisten pengampu'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{profile.role === 'asisten' ? 'Kehadiran' : 'Presensi Kamu'}</Text>
        <View style={styles.presence} accessibilityLiveRegion="polite">
          <View style={[styles.presenceIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={presence.icon} size={22} color={tone.color} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.presenceTitle, { color: tone.color }]}>{presence.title}</Text>
            <Text style={styles.presenceMessage}>{presence.message}</Text>
          </View>
        </View>
        {dibuka || ditutup ? (
          <View style={styles.timeline}>
            {dibuka ? <Text style={styles.timelineText}>Dibuka pukul {jam(dibuka)}</Text> : null}
            {ditutup ? <Text style={styles.timelineText}>Ditutup pukul {jam(ditutup)}</Text> : null}
          </View>
        ) : null}
      </View>

      {pengampu ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Kelola Jadwal</Text>
          {session.status === 'belum_dibuka' ? (
            <View style={styles.manageRow}>
              <Pressable
                style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/session-form', params: { id: session.id } })}
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
                <Text style={styles.manageText}>Ubah Jadwal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.manageButton, styles.manageDanger, pressed && styles.pressed]}
                onPress={hapus}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                <Text style={[styles.manageText, { color: COLORS.danger }]}>Hapus Sesi</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.manageNote}>
              Jadwal terkunci karena sesi sudah dibuka. Buka atau tutup sesi lewat tab Kelola Sesi.
            </Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16 },
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 8,
  },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  rowValue: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  sectionLabel: {
    paddingTop: 8,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.muted,
  },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  presenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  presenceMessage: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  timeline: {
    gap: 2,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timelineText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  manageDanger: { borderColor: COLORS.dangerBorder, backgroundColor: COLORS.dangerLight },
  manageText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  manageNote: {
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  notFound: { flex: 1, padding: 24, backgroundColor: COLORS.background },
  backButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.text,
  },
  pressed: { opacity: 0.85 },
  backButtonText: { color: COLORS.white, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
