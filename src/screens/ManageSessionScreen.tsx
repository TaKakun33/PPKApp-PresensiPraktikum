import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STATUS_SESI } from '../lib/constants';
import type { Session } from '../lib/types';
import {
  alasanTidakBisaDibuka,
  closeSession,
  openSession,
  sesiLupaDitutup,
  subscribeSessions,
  tutupSesiLupaDitutup,
} from '../services/sessionService';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import KelompokHeader from '../components/KelompokHeader';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import { colors, font, layout } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { waktuWib } from '../services/jadwalService';
import { useNamaKelas } from '../hooks/useNamaKelas';
import { kelompokkanSesi, type KunciKelompok } from '../utils/kelompokSesi';

type SessionAction = 'open' | 'close';

type PendingAction = {
  sessionId: string;
  action: SessionAction;
};

type ActionFeedback = {
  message: string;
  ok: boolean;
};

const BATAS_AKAN_DATANG = 2;
const BATAS_DITUTUP = 3;
const BATAS_TERLEWAT = 2;
const GAP_KARTU = 8;
const PADDING_VERTIKAL_SCROLL = 2;
const TINGGI_AWAL_AKAN_DATANG = 308;
const TINGGI_AWAL_DITUTUP = 248;
const TINGGI_AWAL_TERLEWAT = 308;

function batasFixScroll(key: KunciKelompok): number | null {
  if (key === 'akanDatang') return BATAS_AKAN_DATANG;
  if (key === 'ditutup') return BATAS_DITUTUP;
  if (key === 'terlewat') return BATAS_TERLEWAT;
  return null;
}

function tinggiAwalFixScroll(key: KunciKelompok): number {
  if (key === 'ditutup') return TINGGI_AWAL_DITUTUP;
  if (key === 'terlewat') return TINGGI_AWAL_TERLEWAT;
  return TINGGI_AWAL_AKAN_DATANG;
}

/** Jam selesai sesi (WIB) sudah lewat: sesi tidak mungkin dibuka lagi tanpa mengubah jadwal. */
function sudahLewat(session: Session): boolean {
  const selesai = waktuWib(session.tanggal, session.waktuSelesai);
  return !Number.isNaN(selesai) && Date.now() >= selesai;
}

export default function ManageSessionScreen() {
  const { profile, role, loading: authLoading } = useAuth();
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
  const [tinggiKelompok, setTinggiKelompok] = useState<Partial<Record<KunciKelompok, number>>>({});

  const ukurBatasKelompok = useCallback((key: KunciKelompok, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const tinggiPas = Math.ceil(y + height) + PADDING_VERTIKAL_SCROLL;
    setTinggiKelompok((prev) => (prev[key] === tinggiPas ? prev : { ...prev, [key]: tinggiPas }));
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
  const sessions = useMemo(
    () => currentSessionState?.sessions ?? [],
    [currentSessionState]
  );

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

  const renderKartuSesi = (session: Session, onLayout?: (event: LayoutChangeEvent) => void) => (
    <View style={styles.card} key={session.id} onLayout={onLayout}>
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

      <View style={styles.detailsInline}>
        <View style={styles.detailRowInline}>
          <Ionicons name="calendar-outline" size={13.5} color={colors.textSecondary} />
          <Text style={styles.detailTextInline} numberOfLines={1}>
            {session.tanggal} · {session.waktuMulai} - {session.waktuSelesai}
          </Text>
        </View>
        <View style={styles.detailRowInline}>
          <Ionicons name="location-outline" size={13.5} color={colors.textSecondary} />
          <Text style={styles.detailTextInline} numberOfLines={1}>
            {session.ruangan}
          </Text>
        </View>
      </View>

      {session.status === STATUS_SESI.BELUM ? (
        alasanTidakBisaDibuka(session) && sudahLewat(session) ? (
          <View style={styles.cardFooter}>
            <Text style={styles.lockHint} numberOfLines={2}>
              {alasanTidakBisaDibuka(session)}
            </Text>
            <PrimaryButton
              label="Ubah jadwal"
              size="sm"
              style={styles.compactButton}
              onPress={() => router.push({ pathname: '/session-form', params: { id: session.id } })}
              disabled={submitting}
              accessibilityLabel={`Ubah jadwal sesi ${session.praktikum}`}
            />
          </View>
        ) : (
          <View style={styles.cardFooter}>
            {sesiDibuka ? (
              <Text style={styles.lockHint} numberOfLines={2}>
                Tutup sesi {sesiDibuka.praktikum} ({labelKelas(sesiDibuka.kelasId)}) terlebih dahulu.
              </Text>
            ) : alasanTidakBisaDibuka(session) ? (
              <Text style={styles.lockHint} numberOfLines={2}>
                {alasanTidakBisaDibuka(session)}
              </Text>
            ) : null}
            {/* Tombol tetap tampil, tetapi nonaktif selama belum waktunya / ada sesi lain yang dibuka. */}
            <PrimaryButton
              label="Buka sesi"
              size="sm"
              style={styles.compactButton}
              onPress={() => requestAction(session.id, 'open')}
              disabled={submitting || sesiDibuka !== null || alasanTidakBisaDibuka(session) !== null}
              accessibilityLabel={`Buka sesi ${session.praktikum}`}
            />
          </View>
        )
      ) : session.status === STATUS_SESI.DIBUKA ? (
        <View style={styles.actionRow}>
          <PrimaryButton
            label="Presensi"
            size="sm"
            onPress={() => router.push({ pathname: '/presensi-manual', params: { sessionId: session.id } })}
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
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Kelola Sesi" />
      <ScrollView
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
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
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.feedbackText}
                >
                  {feedback.message}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {kelompok.length === 0 ? (
          isLoading ? (
            <LoadingState message="Memuat sesi aktif..." />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Belum ada sesi yang ditugaskan"
              message="Sesi praktikum yang ditugaskan kepadamu akan muncul di sini."
            />
          )
        ) : (
          kelompok.map((section) => {
            const batas = batasFixScroll(section.key);
            const pakaiFixScroll = batas !== null && section.data.length > batas;
            const maxHeight = tinggiKelompok[section.key] ?? tinggiAwalFixScroll(section.key);

            return (
              <View key={section.key}>
                <KelompokHeader
                  judul={section.judul}
                  keterangan={section.keterangan}
                  jumlah={section.data.length}
                  compact
                />
                {pakaiFixScroll ? (
                  <ScrollView
                    style={[styles.fixScroll, { maxHeight }]}
                    contentContainerStyle={styles.sectionScrollContent}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {section.data.map((session, index) =>
                      renderKartuSesi(
                        session,
                        index === batas - 1
                          ? (event) => ukurBatasKelompok(section.key, event)
                          : undefined,
                      ),
                    )}
                  </ScrollView>
                ) : (
                  <View style={styles.sectionList}>
                    {section.data.map((session) => renderKartuSesi(session))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

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
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 4,
    paddingBottom: layout.tabBarSpace,
    gap: 8,
  },
  header: { gap: 6 },
  sectionList: { gap: GAP_KARTU },
  fixScroll: { flexGrow: 0 },
  sectionScrollContent: {
    gap: GAP_KARTU,
    paddingVertical: PADDING_VERTIKAL_SCROLL,
  },
  cardFooter: { gap: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1 },
  compactButton: { minHeight: 34 },
  lockHint: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: font.medium,
    color: colors.textSecondary,
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
    paddingVertical: 9,
    paddingHorizontal: 13,
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sessionInfo: { flex: 1, gap: 1 },
  sessionTitle: { fontSize: 14, lineHeight: 18, fontFamily: font.bold, color: colors.text },
  moduleTitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  detailsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 2,
  },
  detailRowInline: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  detailTextInline: {
    fontSize: 11.5,
    lineHeight: 15,
    fontFamily: font.medium,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
