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
import PrimaryButton from '../components/PrimaryButton';
import StatusBadge from '../components/StatusBadge';
import type { Role } from '../lib/constants';
import type { ClassDoc, Session } from '../lib/types';
import { colors, font, radius, text } from '../constants/theme';
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
  success: { color: colors.success, bg: colors.successTint },
  info: { color: colors.primary, bg: colors.tint },
  neutral: { color: colors.textSecondary, bg: colors.surface },
  danger: { color: colors.danger, bg: colors.dangerTint },
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
      tone: session.status === 'dibuka' ? 'info' : 'neutral',
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
        <Ionicons name={icon} size={18} color={colors.primary} />
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
        <PrimaryButton label="Kembali" onPress={kembali} style={styles.backButton} />
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
        <View style={styles.heroCircle} />
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
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.manageText}>Ubah Jadwal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.manageButton, styles.manageDanger, pressed && styles.pressed]}
                onPress={hapus}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={16} color={colors.text} />
                <Text style={styles.manageText}>Hapus Sesi</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 8, paddingBottom: 32, gap: 16 },
  hero: {
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    padding: 20,
    gap: 8,
  },
  heroCircle: {
    position: 'absolute',
    right: -48,
    top: -46,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  title: { fontSize: 20, lineHeight: 26, fontFamily: font.extraBold, color: colors.white },
  subtitle: { fontSize: 13, fontFamily: font.medium, color: 'rgba(255,255,255,0.78)' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...text.caption },
  rowValue: { fontSize: 14, fontFamily: font.semibold, color: colors.text },
  sectionLabel: {
    paddingTop: 8,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: font.bold,
    color: colors.textSecondary,
  },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  presenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceTitle: { fontSize: 14, fontFamily: font.bold },
  presenceMessage: { ...text.caption, color: colors.textSecondary },
  timeline: {
    gap: 2,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timelineText: { ...text.caption },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  manageDanger: { backgroundColor: colors.surface },
  manageText: { fontSize: 12, fontFamily: font.semibold, color: colors.text },
  manageNote: {
    paddingVertical: 10,
    ...text.body,
  },
  notFound: { flex: 1, padding: 24, backgroundColor: colors.bg },
  backButton: { alignSelf: 'center', minWidth: 160, marginBottom: 24 },
  pressed: { opacity: 0.85 },
});
