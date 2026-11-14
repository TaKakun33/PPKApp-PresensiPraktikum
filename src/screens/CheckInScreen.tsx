import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";
import SuccessBottomSheet from "../components/SuccessBottomSheet";
import { COLORS } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import type { Session } from "../app/types";
import { checkIn, subscribeCheckInState } from "../services/attendanceService";
import { formatJam } from "../utils/format";

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
  const uid = profile?.id ?? "";

  const [session, setSession] = useState<Session | null>(null);
  const [attended, setAttended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTime, setSuccessTime] = useState("");
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
      <View style={styles.container}>
        <EmptyState
          title="Sesi Belum Dipilih"
          message="Silakan pilih sesi praktikum dari halaman jadwal untuk melakukan presensi."
        />
      </View>
    );
  }

  if (loading && uid) {
    return <LoadingState message="Memuat informasi sesi..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Sesi Tidak Ditemukan"
          message="Data sesi praktikum tidak ditemukan atau telah dihapus."
        />
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{session.praktikum}</Text>
          <StatusBadge status={session.status} />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal</Text>
            <Text style={styles.infoValue}>{session.tanggal}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Waktu</Text>
            <Text style={styles.infoValue}>{waktu}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ruangan</Text>
            <Text style={styles.infoValue}>{session.ruangan}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{session.status}</Text>
          </View>
        </View>

        <Pressable
          onPress={handleCheckIn}
          disabled={!canPress}
          style={({ pressed }) => [
            styles.button,
            attended && styles.buttonSuccess,
            !canPress && !attended && styles.buttonDisabled,
            pressed && canPress && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPress }}
        >
          <Text
            style={[
              styles.buttonText,
              !canPress && !attended && styles.buttonTextDisabled,
            ]}
          >
            {buttonLabel}
          </Text>
        </Pressable>

        {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      </View>

      <SuccessBottomSheet
        visible={showSuccess}
        sessionName={session.praktikum}
        waktuHadir={successTime}
        onClose={() => setShowSuccess(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
    color: COLORS.text,
  },
  infoSection: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.muted,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: COLORS.text,
  },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonSuccess: {
    backgroundColor: COLORS.success,
  },
  buttonDisabled: {
    backgroundColor: COLORS.surface,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: COLORS.white,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
  },
  buttonTextDisabled: {
    color: COLORS.muted,
  },
  reason: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.muted,
    textAlign: "center",
  },
});
