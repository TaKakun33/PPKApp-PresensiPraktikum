// Pemilik: Hadrian (feat/schedule-detail), SRS-04.
// Detail satu sesi: praktikum, kelas, tanggal, waktu, ruangan, asisten, dan status.
// Di bawahnya ada kartu kehadiran: praktikan melihat status presensinya, asisten melihat jumlah hadir.
// Id sesi diambil dari URL: /session/s2. Id yang tidak ada (mis. /session/s99) menampilkan EmptyState.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { COLORS, STATUS_COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import type { Role, Session } from '../data/types';
import { formatJam } from '../utils/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Warna kartu kehadiran, diambil dari warna bersama agar senada dengan StatusBadge.
const TONE = {
  success: { color: COLORS.success, bg: STATUS_COLORS.dibuka.bg },
  info: { color: COLORS.primary, bg: COLORS.primaryLight },
  neutral: { color: COLORS.muted, bg: STATUS_COLORS.belum_dibuka.bg },
  danger: { color: COLORS.danger, bg: STATUS_COLORS.ditutup.bg },
};

type Presence = { icon: IoniconsName; tone: keyof typeof TONE; title: string; message: string };

// session.waktu diformat dengan zona waktu perangkat, jadi labelnya juga mengikuti perangkat.
function zonaWaktu(iso: string): string {
  const offset = -new Date(iso).getTimezoneOffset() / 60;
  const nama: Record<number, string> = { 7: 'WIB', 8: 'WITA', 9: 'WIT' };
  return nama[offset] ?? `GMT${offset >= 0 ? '+' : ''}${offset}`;
}

// Isi kartu kehadiran sesuai peran dan status sesi.
// milikSaya = sesi ada di kelas praktikan / diampu asisten (getVisibleSessions).
function describePresence(
  session: Session,
  role: Role,
  milikSaya: boolean,
  waktuHadir: string | undefined,
  jumlahHadir: number,
): Presence {
  if (!milikSaya) {
    return {
      icon: 'information-circle-outline',
      tone: 'neutral',
      title: role === 'asisten' ? 'Bukan sesi yang kamu ampu' : 'Bukan sesi kelasmu',
      message:
        role === 'asisten'
          ? `Sesi ini diampu oleh ${session.asistenNama}, jadi kamu tidak dapat membuka atau menutupnya.`
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
      title: `${jumlahHadir} praktikan hadir`,
      message:
        session.status === 'dibuka'
          ? 'Sesi masih dibuka, jumlah hadir bisa bertambah.'
          : 'Sesi sudah ditutup. Daftar lengkap ada di tab Rekap.',
    };
  }
  if (waktuHadir) {
    return {
      icon: 'checkmark-circle-outline',
      tone: 'success',
      title: 'Kamu sudah presensi',
      message: `Tercatat pukul ${formatJam(waktuHadir)}.`,
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
  const { currentUser, getSessionById, getVisibleSessions, getHistory, getRecap } = useApp();
  const session = getSessionById(id);

  if (!session) {
    return (
      <View style={styles.notFound}>
        <EmptyState
          title="Sesi tidak ditemukan"
          message={`Sesi dengan ID "${id ?? '-'}" tidak ada atau sudah dihapus.`}
        />
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  const waktuHadir = getHistory().find((h) => h.session.id === session.id)?.attendance.waktuHadir;
  const milikSaya = getVisibleSessions().some((s) => s.id === session.id);
  const presence = describePresence(
    session,
    currentUser.role,
    milikSaya,
    waktuHadir,
    getRecap(session.id).length,
  );
  const tone = TONE[presence.tone];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <StatusBadge status={session.status} />
        <Text style={styles.title}>{session.praktikum}</Text>
        <Text style={styles.subtitle}>{session.judulModul}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="book-outline" label="Praktikum" value={session.praktikum} />
        <InfoRow icon="people-outline" label="Kelas" value={`Kelas ${session.kelas}`} />
        <InfoRow icon="calendar-outline" label="Tanggal" value={session.tanggal} />
        <InfoRow icon="time-outline" label="Waktu" value={`${session.waktu} ${zonaWaktu(session.startAt)}`} />
        <InfoRow icon="location-outline" label="Ruangan" value={session.ruangan} />
        <InfoRow icon="person-outline" label="Asisten" value={session.asistenNama} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>
          {currentUser.role === 'asisten' ? 'Kehadiran' : 'Presensi Kamu'}
        </Text>
        <View style={styles.presence} accessibilityLiveRegion="polite">
          <View style={[styles.presenceIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={presence.icon} size={22} color={tone.color} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.presenceTitle, { color: tone.color }]}>{presence.title}</Text>
            <Text style={styles.presenceMessage}>{presence.message}</Text>
          </View>
        </View>
        {session.openedAt || session.closedAt ? (
          <View style={styles.timeline}>
            {session.openedAt ? (
              <Text style={styles.timelineText}>Dibuka pukul {formatJam(session.openedAt)}</Text>
            ) : null}
            {session.closedAt ? (
              <Text style={styles.timelineText}>Ditutup pukul {formatJam(session.closedAt)}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
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
  notFound: { flex: 1, padding: 24, backgroundColor: COLORS.background },
  backButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.text,
  },
  backButtonPressed: { opacity: 0.85 },
  backButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
