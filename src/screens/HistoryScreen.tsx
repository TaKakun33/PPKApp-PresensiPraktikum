import { useEffect, useState } from "react";
import {
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import { COLORS } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import type { Attendance, LeaveRequest } from "../app/types";
import {
  subscribeAttendanceHistory,
  subscribeLeaveHistory,
} from "../services/historyService";
import { formatTanggalJam } from "../utils/format";

function formatTimestamp(value: unknown): string {
  if (value == null) return "Menunggu sinkronisasi...";
  try {
    if (typeof (value as any)?.toDate === "function") {
      return formatTanggalJam((value as any).toDate().toISOString());
    }
    if (typeof (value as any)?.seconds === "number") {
      const d = new Date((value as any).seconds * 1000);
      return formatTanggalJam(d.toISOString());
    }
    if (typeof value === "string") {
      return formatTanggalJam(value);
    }
  } catch {
    // fallback
  }
  return "-";
}

function getLeaveStatusStyle(status: string) {
  const s = status?.toLowerCase();
  if (s === "diterima") {
    return { bg: "#DCFCE7", text: "#16A34A", label: "Diterima" };
  }
  if (s === "ditolak") {
    return { bg: "#FEE2E2", text: "#DC2626", label: "Ditolak" };
  }
  return { bg: "#FEF3C7", text: "#D97706", label: "Menunggu" };
}

export default function HistoryScreen() {
  const { profile } = useAuth();
  const uid = profile?.id ?? "";

  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [attLoaded, setAttLoaded] = useState(false);
  const [leaveLoaded, setLeaveLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setAttLoaded(true);
      setLeaveLoaded(true);
      return;
    }

    setAttLoaded(false);
    setLeaveLoaded(false);
    setError(null);

    const unsubAtt = subscribeAttendanceHistory(
      uid,
      (data) => {
        setAttendances(data);
        setAttLoaded(true);
      },
      (err) => {
        setError(err.message);
        setAttLoaded(true);
      }
    );

    const unsubLeave = subscribeLeaveHistory(
      uid,
      (data) => {
        setLeaves(data);
        setLeaveLoaded(true);
      },
      (err) => {
        setError(err.message);
        setLeaveLoaded(true);
      }
    );

    return () => {
      unsubAtt();
      unsubLeave();
    };
  }, [uid]);

  const isLoading = !attLoaded || !leaveLoaded;

  if (isLoading) {
    return <LoadingState message="Memuat riwayat..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setAttLoaded(false);
          setLeaveLoaded(false);
          setError(null);
        }}
      />
    );
  }

  const isBothEmpty = attendances.length === 0 && leaves.length === 0;

  if (isBothEmpty) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Belum Ada Riwayat"
          message="Riwayat presensi dan permohonan izin kamu akan muncul di sini."
        />
      </View>
    );
  }

  const sections = [
    {
      title: "Kehadiran",
      type: "attendance" as const,
      data: attendances,
    },
    {
      title: "Izin",
      type: "leave" as const,
      data: leaves,
    },
  ];

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      sections={sections}
      keyExtractor={(item, index) => item.id || `item-${index}`}
      renderSectionHeader={({ section: { title, data } }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>({data.length})</Text>
        </View>
      )}
      renderItem={({ item, section }) => {
        if (section.type === "attendance") {
          const att = item as unknown as Attendance;
          const time = att.waktuHadir ?? (att as any).checkedInAt;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {(att as any).name || (att as any).nama || "Presensi Praktikum"}
                </Text>
                <View style={styles.presenceBadge}>
                  <Text style={styles.presenceBadgeText}>Hadir</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>Sesi: {att.sessionId}</Text>
              <Text style={styles.cardText}>Waktu hadir: {formatTimestamp(time)}</Text>
            </View>
          );
        }

        const leave = item as unknown as LeaveRequest;
        const statusStyle = getLeaveStatusStyle(leave.status);
        const kategori = leave.kategoriAI || (leave as any).category;
        const time = (leave as any).createdAt ?? (leave as any).waktuPengajuan;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{leave.praktikum || `Sesi: ${leave.sessionId}`}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                  {statusStyle.label}
                </Text>
              </View>
            </View>

            <Text style={styles.reasonText}>Alasan: {leave.alasan || (leave as any).reason || "-"}</Text>

            {kategori ? (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>Kategori AI: {kategori}</Text>
              </View>
            ) : null}

            {leave.catatanAsisten ? (
              <Text style={styles.notesText}>Catatan: {leave.catatanAsisten}</Text>
            ) : null}

            {time ? (
              <Text style={styles.timeText}>{formatTimestamp(time)}</Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_500Medium",
    color: COLORS.muted,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: COLORS.muted,
  },
  cardText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.textSecondary,
  },
  presenceBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  presenceBadgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#16A34A",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  reasonText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.text,
    marginTop: 2,
  },
  aiBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  aiBadgeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#2563EB",
  },
  notesText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.muted,
    fontStyle: "italic",
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.mutedLight,
    marginTop: 4,
  },
});
