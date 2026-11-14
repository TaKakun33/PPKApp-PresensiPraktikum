import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import StatusBadge from '../components/StatusBadge';
import SuccessBottomSheet from '../components/SuccessBottomSheet';
import { STATUS_LABEL } from '../constants/colors';
import { colors, font, layout, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import type { Session } from '../lib/types';
import { checkIn, subscribeCheckInState } from '../services/attendanceService';
import { formatJam } from '../utils/format';

type Props = {
  route?: {
    params?: {
      sessionId?: string;
    };
  };
};

export default function CheckInScreen({ route }: Props) {
  const localParams = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = route?.params?.sessionId ?? localParams?.sessionId;

  const { profile } = useAuth();
  const uid = profile?.id ?? '';

  const [session, setSession] = useState<Session | null>(null);
  const [attended, setAttended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTime, setSuccessTime] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sessionId || !uid) {
      return;
    }

    const unsubscribe = subscribeCheckInState(
      sessionId,
      uid,
      ({ session: s, attended: a }) => {
        setSession(s);
        setAttended(a);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId, uid, reloadKey]);

  if (!sessionId) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <EmptyState
            compact
            icon="checkbox-outline"
            title="Sesi Belum Dipilih"
            message="Silakan pilih sesi praktikum dari halaman jadwal untuk melakukan presensi."
          />
        </View>
      </View>
    );
  }

  if (loading && uid) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <LoadingState message="Memuat informasi sesi..." />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setReloadKey((key) => key + 1);
            }}
          />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Presensi" />
        <View style={styles.state}>
          <EmptyState
            title="Sesi Tidak Ditemukan"
            message="Data sesi praktikum tidak ditemukan atau telah dihapus."
          />
        </View>
      </View>
    );
  }

  const status = session.status;
  const isBelumDibuka = status === "belum_dibuka" || (status as string) === "Belum Dibuka";
  const isDitutup = status === "ditutup" || (status as string) === "Ditutup";
  const isDibuka = status === "dibuka" || (status as string) === "Dibuka";

  let buttonLabel = "Presensi Sekarang";
  let reason = "";
  let canPress = false;

  if (attended) {
    buttonLabel = "Sudah Hadir";
    reason = "Kamu sudah melakukan presensi pada sesi ini.";
    canPress = false;
  } else if (isBelumDibuka) {
    buttonLabel = "Belum Dibuka";
    reason = "Sesi belum dibuka oleh asisten.";
    canPress = false;
  } else if (isDitutup) {
    buttonLabel = "Ditutup";
    reason = "Sesi sudah ditutup.";
    canPress = false;
  } else if (isDibuka) {
    buttonLabel = isSubmitting ? "Memproses..." : "Presensi Sekarang";
    canPress = !isSubmitting;
  }

  const handleCheckIn = async () => {
    if (!canPress || isSubmitting) return;

    setIsSubmitting(true);
    const result = await checkIn(session.id, {
      uid: profile?.id,
      name: profile?.nama,
      nim: profile?.nim,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setSuccessTime(formatJam(new Date().toISOString()));
      setShowSuccess(true);
    } else {
      Alert.alert("Presensi Gagal", result.message);
    }
  };

  const waktu =
    (session as any).waktu ||
    (session.waktuMulai && session.waktuSelesai
      ? `${session.waktuMulai} - ${session.waktuSelesai}`
      : "-");

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Presensi" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{session.praktikum}</Text>
            <StatusBadge status={session.status} />
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Tanggal</Text>
              </View>
              <Text style={styles.infoValue}>{session.tanggal}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Waktu</Text>
              </View>
              <Text style={styles.infoValue}>{waktu}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Ruangan</Text>
              </View>
              <Text style={styles.infoValue}>{session.ruangan}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelWrap}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.infoLabel}>Status</Text>
              </View>
              <Text style={styles.infoValue}>{STATUS_LABEL[session.status]}</Text>
            </View>
          </View>

          <PrimaryButton
            label={buttonLabel}
            onPress={handleCheckIn}
            disabled={!canPress}
            loading={isSubmitting}
            style={styles.button}
          />

          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        </Card>
      </ScrollView>

      <SuccessBottomSheet
        visible={showSuccess}
        sessionName={session.praktikum}
        waktuHadir={successTime}
        onClose={() => setShowSuccess(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  state: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: layout.tabBarSpace,
    gap: 16,
  },
  card: { padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: font.extraBold,
    color: colors.text,
  },
  infoSection: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  infoLabelWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  infoLabel: { ...text.body },
  infoValue: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.text,
    textAlign: "right",
  },
  button: { marginTop: 4 },
  reason: {
    ...text.caption,
    textAlign: "center",
    color: colors.textSecondary,
  },
});
