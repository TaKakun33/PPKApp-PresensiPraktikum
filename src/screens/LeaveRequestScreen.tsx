// FILE AKMAL (feat/auth-leave-ai) — SRS-13 & SRS-14. Layar pengajuan izin (praktikan).
// Isi: form (pilih sesi + alasan), hasil klasifikasi AI, dan daftar pengajuan milik sendiri (real-time).
// Layar tidak memanggil Firestore/AI langsung; semua lewat leaveService.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { STATUS_IZIN, type StatusIzin } from '../app/constants';
import type { Session } from '../app/types';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  LEAVE_REASON_MAX,
  LEAVE_REASON_MIN,
  isActiveLeave,
  submitLeave,
  subscribeLeaveSessionOptions,
  subscribeMyLeaves,
  validateLeaveReason,
  type LeaveItem,
  type SubmitLeaveResult,
} from '../services/leaveService';
import { getFriendlyError } from '../services/serviceUtils';

const STATUS_STYLE: Record<StatusIzin, { label: string; bg: string; text: string }> = {
  [STATUS_IZIN.MENUNGGU]: { label: 'Menunggu', bg: '#FFF4E5', text: COLORS.warning },
  [STATUS_IZIN.DITERIMA]: { label: 'Diterima', bg: COLORS.successLight, text: COLORS.success },
  [STATUS_IZIN.DITOLAK]: { label: 'Ditolak', bg: COLORS.dangerLight, text: COLORS.danger },
};

function buildNotice(result: SubmitLeaveResult): { tone: 'ok' | 'info'; text: string } {
  const aiText =
    result.aiStatus === 'berhasil' && result.kategoriAI
      ? `Kategori alasan menurut AI: ${result.kategoriAI}.`
      : 'Kategori AI belum tersedia (alasan belum bisa dianalisis), tetapi asisten tetap dapat memeriksa alasanmu.';

  if (result.queued) {
    return {
      tone: 'info',
      text: `Koneksi sedang lambat. Pengajuanmu disimpan di perangkat dan akan terkirim otomatis saat online. ${aiText}`,
    };
  }
  return { tone: 'ok', text: `Pengajuan terkirim dengan status Menunggu. ${aiText}` };
}

export default function LeaveRequestScreen() {
  const { profile } = useAuth();

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [leaves, setLeaves] = useState<LeaveItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'info'; text: string } | null>(null);

  const userId = profile?.id;

  // Listener real-time sesi & pengajuan; di-unsubscribe saat layar ditutup / ulang coba.
  useEffect(() => {
    if (!profile || profile.role !== 'praktikan') return;

    const onError = (e: unknown) =>
      setLoadError(getFriendlyError(e, 'Data izin gagal dimuat. Periksa koneksi internet.'));

    const unsubSessions = subscribeLeaveSessionOptions(profile, setSessions, onError);
    const unsubLeaves = subscribeMyLeaves(profile.id, setLeaves, onError);
    return () => {
      unsubSessions();
      unsubLeaves();
    };
    // profile diganti objek baru tiap snapshot profil; cukup bergantung pada id & kelasIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profile?.kelasIds?.join(','), retryKey]);

  const handleRetry = () => {
    setLoadError('');
    setSessions(null);
    setLeaves(null);
    setRetryKey((k) => k + 1);
  };

  if (!profile) return <LoadingState message="Memuat akun..." />;
  if (profile.role !== 'praktikan') {
    return <ErrorState message="Pengajuan izin hanya tersedia untuk praktikan." />;
  }
  if (loadError) return <ErrorState message={loadError} onRetry={handleRetry} />;
  if (sessions === null || leaves === null) return <LoadingState message="Memuat data izin..." />;

  const activeSessionIds = new Set(leaves.filter(isActiveLeave).map((l) => l.sessionId));
  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;
  const trimmedLength = alasan.trim().length;

  const handleSubmit = async () => {
    if (submitting) return;
    setFormError('');
    setNotice(null);

    if (!selectedSession) {
      setFormError('Pilih sesi yang ingin diajukan izin.');
      return;
    }
    const reasonError = validateLeaveReason(alasan);
    if (reasonError) {
      setFormError(reasonError);
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const result = await submitLeave(profile, selectedSession, alasan);
      setAlasan('');
      setSelectedId(null);
      setNotice(buildNotice(result));
    } catch (e: unknown) {
      setFormError(getFriendlyError(e, 'Pengajuan izin gagal dikirim. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Dibuat sebagai elemen (bukan komponen) agar TextInput tidak di-remount dan kehilangan fokus.
  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajukan Izin</Text>
        <Text style={styles.subtitle}>
          Pilih sesi yang tidak bisa kamu ikuti, lalu tuliskan alasannya. Asisten yang akan memutuskan.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Pilih sesi</Text>
        {sessions.length === 0 ? (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
            <Text style={styles.infoText}>
              {profile.kelasIds && profile.kelasIds.length > 0
                ? 'Belum ada sesi yang bisa diajukan izin. Sesi yang sudah ditutup tidak ditampilkan.'
                : 'Kamu belum terdaftar di kelas mana pun. Hubungi asisten pengampu.'}
            </Text>
          </View>
        ) : (
          <View style={styles.optionList}>
            {sessions.map((s) => {
              const taken = activeSessionIds.has(s.id);
              const selected = selectedId === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.option, selected && styles.optionSelected, taken && styles.optionDisabled]}
                  onPress={() => {
                    setSelectedId(s.id);
                    setFormError('');
                  }}
                  disabled={taken || submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: taken }}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? COLORS.primary : COLORS.mutedLight}
                  />
                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>{s.praktikum}</Text>
                    <Text style={styles.optionMeta}>
                      {s.tanggal} · {s.waktuMulai}–{s.waktuSelesai} · {s.ruangan}
                    </Text>
                    {taken ? <Text style={styles.optionTaken}>Izin untuk sesi ini sudah diajukan</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.label, styles.labelSpaced]}>Alasan ketidakhadiran</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Contoh: Sakit dan sudah ada surat dokter."
          placeholderTextColor={COLORS.mutedLight}
          value={alasan}
          onChangeText={(t) => {
            setAlasan(t);
            setFormError('');
          }}
          multiline
          maxLength={LEAVE_REASON_MAX}
          textAlignVertical="top"
          editable={!submitting}
        />
        <Text style={styles.counter}>
          {trimmedLength}/{LEAVE_REASON_MAX} karakter (minimal {LEAVE_REASON_MIN})
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.muted} />
          <Text style={styles.infoText}>
            Alasanmu dianalisis oleh model AI di perangkatmu (tidak dikirim ke internet) untuk menentukan
            kategori. AI hanya memberi informasi pendukung dan tidak menentukan izin diterima atau ditolak.
          </Text>
        </View>

        {formError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        {notice ? (
          <View style={[styles.noticeBox, notice.tone === 'ok' ? styles.noticeOk : styles.noticeInfo]}>
            <Ionicons
              name={notice.tone === 'ok' ? 'checkmark-circle' : 'cloud-offline-outline'}
              size={16}
              color={notice.tone === 'ok' ? COLORS.success : COLORS.warning}
            />
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Kirim pengajuan izin"
        >
          {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : null}
          <Text style={styles.buttonText}>{submitting ? 'Mengirim...' : 'Kirim Pengajuan'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Pengajuan Saya ({leaves.length})</Text>
    </View>
  );

  // behavior="padding" di Android DAN iOS: Android edge-to-edge tidak me-resize jendela sendiri.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={leaves}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <LeaveCard item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="file-tray-outline" size={28} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>Belum ada pengajuan izin</Text>
            <Text style={styles.emptyText}>Pengajuan yang kamu kirim akan muncul di sini beserta statusnya.</Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

function LeaveCard({ item }: { item: LeaveItem }) {
  const status = STATUS_STYLE[item.status] ?? STATUS_STYLE[STATUS_IZIN.MENUNGGU];
  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveTop}>
        <Text style={styles.leaveTitle} numberOfLines={2}>
          {item.praktikum}
        </Text>
        <View style={[styles.pill, { backgroundColor: status.bg }]}>
          <Text style={[styles.pillText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.leaveReason}>{item.alasan}</Text>
      <Text style={styles.leaveMeta}>
        Kategori AI (info pendukung):{' '}
        <Text style={styles.leaveMetaStrong}>{item.kategoriAI ?? 'tidak tersedia'}</Text>
      </Text>
      {item.catatanAsisten ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Catatan asisten</Text>
          <Text style={styles.noteText}>{item.catatanAsisten}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, padding: 20, paddingBottom: 32 },
  headerWrap: { gap: 16, marginBottom: 12 },
  header: { gap: 4 },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
  },
  label: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  labelSpaced: { marginTop: 6 },
  optionList: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionDisabled: { opacity: 0.55 },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  optionMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  optionTaken: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.warning },
  textArea: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text,
  },
  counter: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, textAlign: 'right' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.danger },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeOk: { backgroundColor: COLORS.successLight, borderColor: '#C8F0D5' },
  noticeInfo: { backgroundColor: '#FFF4E5', borderColor: '#FFE0B2' },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.text },
  button: {
    marginTop: 4,
    backgroundColor: COLORS.text,
    paddingVertical: 15,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.white },
  sectionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text, marginTop: 4 },
  separator: { height: 10 },
  emptyBox: {
    alignItems: 'center',
    gap: 6,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderLight,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  emptyText: { fontSize: 13, textAlign: 'center', fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  leaveCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  leaveTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  leaveTitle: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  leaveReason: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.textSecondary },
  leaveMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  leaveMetaStrong: { fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  noteBox: { padding: 10, borderRadius: 10, backgroundColor: COLORS.surface, gap: 2 },
  noteLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.muted },
  noteText: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text },
});
