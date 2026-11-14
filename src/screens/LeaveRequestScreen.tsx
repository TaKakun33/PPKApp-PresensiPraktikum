// FILE AKMAL (feat/auth-leave-ai) — SRS-13 & SRS-14. Layar pengajuan izin (praktikan).
// Isi: form (pilih sesi + alasan), hasil klasifikasi AI, dan daftar pengajuan milik sendiri (real-time).
// Layar tidak memanggil Firestore/AI langsung; semua lewat leaveService.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { STATUS_IZIN } from '../lib/constants';
import type { Session } from '../lib/types';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { labelKategori } from '../services/aiService';
import {
  LEAVE_REASON_MAX,
  LEAVE_REASON_MIN,
  cancelLeave,
  isActiveLeave,
  submitLeave,
  subscribeLeaveSessionOptions,
  subscribeMyLeaves,
  validateLeaveReason,
  type LeaveItem,
  type SubmitLeaveResult,
} from '../services/leaveService';
import { getFriendlyError } from '../services/serviceUtils';

type Notice = { tone: 'ok' | 'info' | 'error'; text: string };

function buildNotice(result: SubmitLeaveResult): Notice {
  const aiText =
    result.aiStatus === 'berhasil' && result.kategoriAI
      ? `Kategori alasan menurut AI: ${labelKategori(result.kategoriAI)}.`
      : 'Kategori AI belum tersedia (alasan belum bisa dianalisis), tetapi asisten tetap dapat memeriksa alasanmu.';

  if (result.queued) {
    return {
      tone: 'info',
      text: `Koneksi sedang lambat. Pengajuanmu antre di perangkat dan akan dikirim saat online; statusnya akan kami kabarkan di sini. ${aiText}`,
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Hasil akhir pengajuan yang antre baru datang belakangan; jangan set state kalau layar sudah ditutup.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Izin" />
        <View style={styles.state}>
          <ErrorState message="Pengajuan izin hanya tersedia untuk praktikan." />
        </View>
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Izin" />
        <View style={styles.state}>
          <ErrorState message={loadError} onRetry={handleRetry} />
        </View>
      </View>
    );
  }
  if (sessions === null || leaves === null) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Izin" />
        <View style={styles.state}>
          <LoadingState message="Memuat data izin..." />
        </View>
      </View>
    );
  }

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
      if (result.queued) {
        // Pengajuan antre bisa saja ditolak server nanti (mis. sesi keburu ditutup): beri tahu hasil akhirnya.
        result.settled.then((outcome) => {
          if (!mountedRef.current) return;
          if (outcome.ok) {
            setNotice({ tone: 'ok', text: 'Pengajuan yang tertunda sudah terkirim ke server dengan status Menunggu.' });
          } else {
            setNotice({
              tone: 'error',
              text: `Pengajuan yang tertunda ditolak server. ${getFriendlyError(outcome.error, 'Pengajuan tidak dapat disimpan.')} Silakan ajukan ulang.`,
            });
          }
        });
      }
    } catch (e: unknown) {
      setFormError(getFriendlyError(e, 'Pengajuan izin gagal dikirim. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    const target = cancelTarget;
    if (!target || cancelling) return;
    setCancelling(true);
    setFormError('');
    try {
      const queued = await cancelLeave(profile, target);
      setNotice(
        queued
          ? { tone: 'info', text: 'Koneksi lambat. Pembatalan akan diproses saat perangkat online.' }
          : { tone: 'ok', text: 'Pengajuan dibatalkan. Kamu bisa mengajukan ulang untuk sesi ini.' },
      );
    } catch (e: unknown) {
      setNotice({ tone: 'error', text: getFriendlyError(e, 'Pengajuan gagal dibatalkan. Coba lagi.') });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
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

      <Card style={styles.formCard}>
        <Text style={styles.label}>Pilih sesi</Text>
        {sessions.length === 0 ? (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
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
                    color={selected ? colors.primary : colors.placeholder}
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
          placeholderTextColor={colors.placeholder}
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

        <View style={styles.aiBox}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={styles.aiText}>
            Alasanmu dianalisis oleh model AI di perangkatmu (tidak dikirim ke internet) untuk menentukan
            kategori sentimen (positif, netral, atau negatif). AI hanya memberi informasi pendukung dan tidak menentukan izin diterima atau ditolak.
          </Text>
        </View>

        {formError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        {notice ? (
          <View
            style={[
              styles.noticeBox,
              notice.tone === 'ok' ? styles.noticeOk : notice.tone === 'error' ? styles.noticeError : styles.noticeInfo,
            ]}
          >
            <Ionicons
              name={
                notice.tone === 'ok' ? 'checkmark-circle' : notice.tone === 'error' ? 'alert-circle' : 'cloud-offline-outline'
              }
              size={16}
              color={notice.tone === 'ok' ? colors.success : notice.tone === 'error' ? colors.danger : colors.warning}
            />
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
          onPress={handleSubmit}
          disabled={submitting}
          loading={submitting}
          style={styles.submit}
        />
      </Card>

      <Text style={styles.sectionTitle}>Pengajuan Saya ({leaves.length})</Text>
    </View>
  );

  // behavior="padding" di Android DAN iOS: Android edge-to-edge tidak me-resize jendela sendiri.
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Izin" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.content}
          data={leaves}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <LeaveCard item={item} onCancel={() => setCancelTarget(item)} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Belum ada pengajuan izin</Text>
              <Text style={styles.emptyText}>Pengajuan yang kamu kirim akan muncul di sini beserta statusnya.</Text>
            </View>
          }
        />
        <ConfirmModal
          visible={cancelTarget !== null}
          title="Batalkan pengajuan?"
          message="Pengajuan izin ini akan dihapus. Kamu bisa mengajukan ulang untuk sesi yang sama selama sesinya belum ditutup."
          confirmLabel={cancelling ? 'Membatalkan...' : 'Batalkan'}
          onConfirm={handleConfirmCancel}
          onCancel={() => (cancelling ? undefined : setCancelTarget(null))}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function LeaveCard({ item, onCancel }: { item: LeaveItem; onCancel: () => void }) {
  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveTop}>
        <Text style={styles.leaveTitle} numberOfLines={2}>
          {item.praktikum}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.leaveReason}>{item.alasan}</Text>
      <Text style={styles.leaveMeta}>
        Kategori AI (info pendukung):{' '}
        <Text style={styles.leaveMetaStrong}>{labelKategori(item.kategoriAI)}</Text>
      </Text>
      {item.pending ? (
        <Text style={styles.pendingText}>Belum terkirim ke server — akan dikirim otomatis saat online.</Text>
      ) : null}
      {item.catatanAsisten ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Catatan asisten</Text>
          <Text style={styles.noteText}>{item.catatanAsisten}</Text>
        </View>
      ) : null}
      {item.status === STATUS_IZIN.MENUNGGU ? (
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Batalkan pengajuan izin"
        >
          <Ionicons name="close-circle-outline" size={15} color={colors.primary} />
          <Text style={styles.cancelText}>Batalkan pengajuan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { flex: 1 },
  state: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: layout.tabBarSpace,
  },
  headerWrap: { gap: 16, marginBottom: 12 },
  header: { gap: 5 },
  title: { fontSize: 20, fontFamily: font.extraBold, color: colors.text },
  subtitle: { ...text.body },
  formCard: { padding: 18, gap: 10 },
  label: { ...text.bodyStrong },
  labelSpaced: { marginTop: 6 },
  optionList: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.tint },
  optionDisabled: { opacity: 0.55 },
  optionBody: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: colors.text },
  optionMeta: { ...text.caption },
  optionTaken: { fontSize: 12, fontFamily: font.semibold, color: colors.warning },
  textArea: {
    minHeight: 116,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.medium,
    color: colors.text,
  },
  counter: { ...text.caption, textAlign: 'right' },
  aiBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  aiText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: font.medium, color: colors.primary },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: font.medium, color: colors.textSecondary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerTint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: font.medium, color: colors.danger },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeOk: { backgroundColor: colors.successTint, borderColor: colors.success },
  noticeInfo: { backgroundColor: colors.warningTint, borderColor: colors.warning },
  noticeError: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.text },
  submit: { marginTop: 4 },
  sectionTitle: { ...text.sectionTitle, marginTop: 4 },
  separator: { height: 10 },
  emptyBox: {
    alignItems: 'center',
    gap: 7,
    padding: 26,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.card,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  emptyTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  emptyText: { ...text.caption, textAlign: 'center' },
  leaveCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 8,
  },
  leaveTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  leaveTitle: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: colors.text },
  leaveReason: { ...text.body, color: colors.textSecondary },
  leaveMeta: { ...text.caption },
  leaveMetaStrong: { fontFamily: font.semibold, color: colors.text },
  pendingText: { fontSize: 12, fontFamily: font.medium, color: colors.warning },
  cancelBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { fontSize: 12, fontFamily: font.semibold, color: colors.primary },
  buttonPressed: { opacity: 0.82 },
  noteBox: { padding: 11, borderRadius: 14, backgroundColor: colors.surface, gap: 2 },
  noteLabel: { fontSize: 11, fontFamily: font.bold, color: colors.textSecondary },
  noteText: { ...text.body, color: colors.text },
});
