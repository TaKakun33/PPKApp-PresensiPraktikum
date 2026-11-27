import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STATUS_SESI } from '../lib/constants';
import type { Session } from '../lib/types';
import {
  alasanTidakBisaDibuka,
  closeSession,
  labelTanggal,
  labelWaktu,
  openSession,
  sesiLupaDitutup,
  subscribeSessions,
  tutupSesiLupaDitutup,
} from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { waktuWib } from '../services/jadwalService';
import { useNamaKelas } from '../hooks/useNamaKelas';
import { kelompokkanSesi } from '../utils/kelompokSesi';

type SessionAction = 'open' | 'close';
type TabKelolaSesi = 'akanDatang' | 'ditutup';

const BATAS_TAMPIL_AKAN_DATANG = 3;
const BATAS_TAMPIL_DITUTUP = 4;
const GAP_KARTU = 10;
const PADDING_ATAS_SCROLL = 2;
const PADDING_BAWAH_SCROLL = 4;

type PendingAction = {
  sessionId: string;
  action: SessionAction;
};

type ActionFeedback = {
  message: string;
  ok: boolean;
};

/** Jam selesai sesi (WIB) sudah lewat: sesi tidak mungkin dibuka lagi tanpa mengubah jadwal. */
function sudahLewat(session: Session): boolean {
  const selesai = waktuWib(session.tanggal, session.waktuSelesai);
  return !Number.isNaN(selesai) && Date.now() >= selesai;
}

export default function ManageSessionScreen() {
  const { profile, role, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const profileId = profile?.id;
  const { labelKelas } = useNamaKelas();
  const [sessionState, setSessionState] = useState<{
    profileId: string;
    sessions: Session[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tabAktif, setTabAktif] = useState<TabKelolaSesi>('akanDatang');
  const [tinggiViewport, setTinggiViewport] = useState<number | null>(null);
  const [tinggiAkanDatang, setTinggiAkanDatang] = useState<number | null>(null);
  const [tinggiDitutup, setTinggiDitutup] = useState<number | null>(null);

  const ukurViewport = useCallback((event: LayoutChangeEvent) => {
    const tinggi = Math.floor(event.nativeEvent.layout.height);
    if (tinggi > 0) {
      setTinggiViewport((prev) => (prev === tinggi ? prev : tinggi));
    }
  }, []);

  const ukurBatasAkanDatang = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const tinggiPas = Math.ceil(y + height) + PADDING_BAWAH_SCROLL;
    setTinggiAkanDatang((prev) => (prev === tinggiPas ? prev : tinggiPas));
  }, []);

  const ukurBatasDitutup = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const tinggiPas = Math.ceil(y + height) + PADDING_BAWAH_SCROLL;
    setTinggiDitutup((prev) => (prev === tinggiPas ? prev : tinggiPas));
  }, []);

  useEffect(() => {
    if (!profile || role !== 'asisten') {
      return;
    }

    const unsubscribe = subscribeSessions(
      profile,
      (items) => {
        setSessionState({
          profileId: profile.id,
          sessions: items,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setSessionState({
          profileId: profile.id,
          sessions: [],
          loading: false,
          error: error.message || 'Gagal memuat sesi praktikum.',
        });
      }
    );

    return unsubscribe;
    // profile berganti objek tiap snapshot profil; cukup bergantung pada id & peran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, role]);

  const currentSessionState =
    sessionState && sessionState.profileId === profile?.id ? sessionState : null;
  const sessions = currentSessionState?.sessions ?? [];

  // Tutup otomatis sesi dibuka yang lupa ditutup (lewat 1 jam dari jam selesai). Dicek tiap data sesi
  // berubah dan tiap menit selama layar ini terbuka.
  const sessionsRef = useRef<Session[]>([]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const adaSesiLupa = sessions.some((item) => sesiLupaDitutup(item));
  useEffect(() => {
    if (role !== 'asisten') return;
    const jalankan = () => void tutupSesiLupaDitutup(sessionsRef.current);
    jalankan();
    const timer = setInterval(jalankan, 60000);
    return () => clearInterval(timer);
  }, [role, adaSesiLupa, profileId]);

  // Detak per 30 detik: kelompok (Hari ini / Terlewat) dan alasan tombol Buka sesi ikut berubah saat jam berjalan.
  const [, setDetak] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setDetak((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const kelompok = kelompokkanSesi(sessions);
  const sesiAkanDatang = kelompok
    .filter((k) => ['dibuka', 'hariIni', 'akanDatang'].includes(k.key))
    .flatMap((k) => k.data);
  const sesiDitutup = kelompok
    .filter((k) => ['terlewat', 'ditutup'].includes(k.key))
    .flatMap((k) => k.data);
  const jumlahAkanDatang = sesiAkanDatang.length;
  const jumlahDitutup = sesiDitutup.length;
  const daftarTampil = tabAktif === 'akanDatang' ? sesiAkanDatang : sesiDitutup;
  const batasTampil =
    tabAktif === 'akanDatang' ? BATAS_TAMPIL_AKAN_DATANG : BATAS_TAMPIL_DITUTUP;
  const pakaiFixScroll = daftarTampil.length > batasTampil;
  const tinggiKartuTarget =
    tinggiViewport !== null
      ? Math.max(
          0,
          Math.floor(
            (tinggiViewport -
              (batasTampil - 1) * GAP_KARTU -
              PADDING_ATAS_SCROLL -
              PADDING_BAWAH_SCROLL) /
              batasTampil,
          ),
        )
      : undefined;
  const tinggiTerukur = tabAktif === 'akanDatang' ? tinggiAkanDatang : tinggiDitutup;
  const ukurKartuBatas =
    tabAktif === 'akanDatang' ? ukurBatasAkanDatang : ukurBatasDitutup;
  const jarakBawahTabBar = Math.max(insets.bottom, 10) + 84;

  const isLoading = role === 'asisten' && (!currentSessionState || currentSessionState.loading);
  const loadError = currentSessionState?.error ?? null;

  // Satu asisten hanya boleh membuka satu sesi sekaligus: sesi lain terkunci selama ada yang dibuka.
  const sesiDibuka = sessions.find((session) => session.status === STATUS_SESI.DIBUKA) ?? null;

  const pendingSession = pendingAction
    ? sessions.find((session) => session.id === pendingAction.sessionId)
    : undefined;

  const requestAction = (sessionId: string, action: SessionAction) => {
    if (submitting) return;
    setFeedback(null);
    setPendingAction({ sessionId, action });
  };

  const confirmAction = async () => {
    if (!pendingAction || !profile || submitting) return;

    const targetSession = sessions.find((session) => session.id === pendingAction.sessionId);
    if (!targetSession) {
      setFeedback({ message: 'Sesi tidak ditemukan.', ok: false });
      setPendingAction(null);
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (pendingAction.action === 'open') {
        await openSession(targetSession.id, profile.id);
        setFeedback({
          message: `Sesi ${targetSession.praktikum} berhasil dibuka.`,
          ok: true,
        });
      } else {
        await closeSession(targetSession.id, profile.id);
        setFeedback({
          message: `Sesi ${targetSession.praktikum} berhasil ditutup.`,
          ok: true,
        });
      }
      setPendingAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengubah status sesi.';
      setFeedback({ message, ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingActionLabel = pendingAction?.action === 'open' ? 'Buka' : 'Tutup';
  const pendingSessionName = pendingSession?.praktikum ?? 'sesi ini';
  const confirmMessage =
    pendingAction?.action === 'close'
      ? `Apakah kamu yakin ingin menutup ${pendingSessionName}? Sesi yang sudah ditutup tidak dapat dibuka kembali.`
      : `Apakah kamu yakin ingin membuka ${pendingSessionName}?`;

  if (authLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kelola Sesi" />
        <View style={styles.state}>
          <LoadingState message="Memuat profil asisten..." />
        </View>
      </View>
    );
  }

  if (role !== 'asisten') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kelola Sesi" />
        <View style={styles.state}>
          <EmptyState
            icon="lock-closed-outline"
            title="Fitur khusus asisten"
            message="Hanya asisten pengampu yang dapat mengelola status sesi praktikum."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Kelola Sesi" />
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTabAktif('akanDatang')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabAktif === 'akanDatang' }}
            style={({ pressed }) => [
              styles.tabItem,
              tabAktif === 'akanDatang' && styles.tabItemActive,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.tabLabel, tabAktif === 'akanDatang' && styles.tabLabelActive]}>
              Akan datang ({jumlahAkanDatang})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTabAktif('ditutup')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabAktif === 'ditutup' }}
            style={({ pressed }) => [
              styles.tabItem,
              tabAktif === 'ditutup' && styles.tabItemActive,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.tabLabel, tabAktif === 'ditutup' && styles.tabLabelActive]}>
              Ditutup ({jumlahDitutup})
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.bodyWrap, { paddingBottom: jarakBawahTabBar }]}>
        {loadError || feedback ? (
          <View style={styles.header}>
            {loadError ? (
              <View style={[styles.feedback, styles.errorFeedback]}>
                <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
                  {loadError}
                </Text>
              </View>
            ) : null}

            {feedback ? (
              <View
                style={[
                  styles.feedback,
                  feedback.ok ? styles.successFeedback : styles.errorFeedback,
                ]}
              >
                <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
                  {feedback.message}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.listViewport} onLayout={ukurViewport}>
          {daftarTampil.length === 0 ? (
            <View style={styles.emptyWrap}>
              {isLoading ? (
                <LoadingState message="Memuat sesi aktif..." />
              ) : sessions.length === 0 ? (
                <EmptyState
                  icon="calendar-outline"
                  title="Belum ada sesi yang ditugaskan"
                  message="Sesi praktikum yang ditugaskan kepadamu akan muncul di sini."
                />
              ) : tabAktif === 'akanDatang' ? (
                <EmptyState
                  icon="calendar-outline"
                  title="Tidak ada sesi akan datang"
                  message="Belum ada sesi aktif atau jadwal mendatang saat ini."
                />
              ) : (
                <EmptyState
                  icon="checkmark-done-outline"
                  title="Belum ada sesi ditutup"
                  message="Sesi yang sudah ditutup atau selesai akan muncul di sini."
                />
              )}
            </View>
          ) : (
            <ScrollView
              key={tabAktif}
              style={[
                styles.fixScroll,
                pakaiFixScroll && tinggiTerukur !== null && { maxHeight: tinggiTerukur },
              ]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={pakaiFixScroll}
            >
              {daftarTampil.map((session, index) => (
                <View
                  style={[
                    styles.card,
                    tinggiKartuTarget !== undefined && { minHeight: tinggiKartuTarget },
                  ]}
                  key={session.id}
                  onLayout={
                    pakaiFixScroll && index === batasTampil - 1 ? ukurKartuBatas : undefined
                  }
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>
                        {session.praktikum}
                      </Text>
                      <Text style={styles.moduleTitle} numberOfLines={1}>
                        {labelKelas(session.kelasId)}
                      </Text>
                    </View>
                    <StatusBadge status={session.status} />
                  </View>

                  <View
                    style={
                      session.status === STATUS_SESI.DITUTUP
                        ? styles.details
                        : styles.detailsInline
                    }
                  >
                    <View
                      style={
                        session.status === STATUS_SESI.DITUTUP
                          ? styles.detailRow
                          : styles.detailRowInline
                      }
                    >
                      <Ionicons name="calendar-outline" size={13.5} color={colors.textSecondary} />
                      <Text
                        style={
                          session.status === STATUS_SESI.DITUTUP
                            ? styles.detailText
                            : styles.detailTextInline
                        }
                        numberOfLines={1}
                      >
                        {session.tanggal} · {session.waktuMulai} - {session.waktuSelesai}
                      </Text>
                    </View>
                    <View
                      style={
                        session.status === STATUS_SESI.DITUTUP
                          ? styles.detailRow
                          : styles.detailRowInline
                      }
                    >
                      <Ionicons name="location-outline" size={13.5} color={colors.textSecondary} />
                      <Text
                        style={
                          session.status === STATUS_SESI.DITUTUP
                            ? styles.detailText
                            : styles.detailTextInline
                        }
                        numberOfLines={1}
                      >
                        {session.ruangan}
                      </Text>
                    </View>
                  </View>

                  {session.status === STATUS_SESI.BELUM ? (
                    alasanTidakBisaDibuka(session) && sudahLewat(session) ? (
                      <View style={styles.cardFooter}>
                        <Text style={styles.lockHint}>{alasanTidakBisaDibuka(session)}</Text>
                        <PrimaryButton
                          label="Ubah jadwal"
                          size="sm"
                          style={styles.compactButton}
                          onPress={() =>
                            router.push({ pathname: '/session-form', params: { id: session.id } })
                          }
                          disabled={submitting}
                          accessibilityLabel={`Ubah jadwal sesi ${session.praktikum}`}
                        />
                      </View>
                    ) : (
                      <View style={styles.cardFooter}>
                        {sesiDibuka ? (
                          <Text style={styles.lockHint}>
                            Tutup sesi {sesiDibuka.praktikum} ({labelKelas(sesiDibuka.kelasId)}) terlebih dahulu.
                          </Text>
                        ) : alasanTidakBisaDibuka(session) ? (
                          <View style={styles.lockHintWrap}>
                            <Text style={styles.lockHint}>
                              Sesi baru bisa dibuka pada jam yang dibooking
                            </Text>
                            <Text style={styles.lockHintSchedule}>
                              {labelTanggal(session.tanggal)} · {labelWaktu(session)} WIB
                            </Text>
                          </View>
                        ) : null}
                        {/* Tombol tetap tampil, tetapi nonaktif selama belum waktunya / ada sesi lain yang dibuka. */}
                        <PrimaryButton
                          label="Buka sesi"
                          size="sm"
                          style={styles.compactButton}
                          onPress={() => requestAction(session.id, 'open')}
                          disabled={
                            submitting || sesiDibuka !== null || alasanTidakBisaDibuka(session) !== null
                          }
                          accessibilityLabel={`Buka sesi ${session.praktikum}`}
                        />
                      </View>
                    )
                  ) : session.status === STATUS_SESI.DIBUKA ? (
                    <View style={styles.actionRow}>
                      <PrimaryButton
                        label="Presensi"
                        size="sm"
                        onPress={() =>
                          router.push({ pathname: '/presensi-manual', params: { sessionId: session.id } })
                        }
                        disabled={submitting}
                        accessibilityLabel={`Presensi sesi ${session.praktikum}`}
                        style={[styles.actionButton, styles.compactButton]}
                      />
                      <PrimaryButton
                        label="Tutup sesi"
                        size="sm"
                        variant="secondary"
                        onPress={() => requestAction(session.id, 'close')}
                        disabled={submitting}
                        accessibilityLabel={`Tutup sesi ${session.praktikum}`}
                        style={[styles.actionButton, styles.compactButton]}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <ConfirmModal
        visible={pendingAction !== null}
        title={`${pendingActionLabel} sesi?`}
        message={confirmMessage}
        confirmLabel={submitting ? 'Memproses...' : 'Konfirmasi'}
        onConfirm={confirmAction}
        onCancel={() => {
          if (!submitting) setPendingAction(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  state: { flex: 1 },
  tabBarWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    paddingBottom: 10,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.onPrimary,
  },
  bodyWrap: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    gap: 8,
  },
  listViewport: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
  },
  fixScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: GAP_KARTU,
    paddingTop: PADDING_ATAS_SCROLL,
    paddingBottom: PADDING_BAWAH_SCROLL,
  },
  header: { gap: 6 },
  cardFooter: { gap: 5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  compactButton: { minHeight: 36 },
  lockHintWrap: { alignItems: 'center', gap: 1 },
  lockHint: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: font.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  lockHintSchedule: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: font.semibold,
    color: colors.secondaryText,
    textAlign: 'center',
  },
  feedback: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  successFeedback: { borderColor: colors.success, backgroundColor: colors.successTint },
  errorFeedback: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  feedbackText: { fontSize: 12, lineHeight: 17, fontFamily: font.medium, color: colors.text },
  card: {
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionInfo: { flex: 1, gap: 1 },
  sessionTitle: { fontSize: 14.5, lineHeight: 19, fontFamily: font.bold, color: colors.text },
  moduleTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  details: {
    gap: 5,
  },
  detailsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 2,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailRowInline: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  detailText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  detailTextInline: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: font.medium,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
