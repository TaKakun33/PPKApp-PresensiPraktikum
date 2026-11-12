import {
  collection,
  onSnapshot,
  query,
  where,
  type FirestoreError,
  type QuerySnapshot,
} from "@react-native-firebase/firestore";

import { db } from "../app/firebase";
import type { Attendance, LeaveRequest } from "../app/types";

function getTimestampMillis(val: unknown): number {
  if (val == null) return Infinity;
  if (typeof (val as any)?.toMillis === "function") return (val as any).toMillis();
  if (typeof (val as any)?.toDate === "function") return (val as any).toDate().getTime();
  if (typeof (val as any)?.seconds === "number") return (val as any).seconds * 1000;
  if (typeof val === "string" || typeof val === "number") {
    const parsed = Date.parse(val as string);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function subscribeAttendanceHistory(
  uid: string,
  onData: (attendances: Attendance[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!uid) {
    onData([]);
    return () => {};
  }

  try {
    const q = query(collection(db, "attendances"), where("userId", "==", uid));

    return onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        try {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() ?? {}) } as Attendance));
          list.sort((a: any, b: any) => {
            const timeA = getTimestampMillis(a.waktuHadir ?? a.checkedInAt);
            const timeB = getTimestampMillis(b.waktuHadir ?? b.checkedInAt);
            return timeB - timeA;
          });
          onData(list);
        } catch {
          onError?.(new Error("Gagal mengolah data riwayat presensi."));
        }
      },
      (_err: FirestoreError) => {
        onError?.(new Error("Gagal memuat riwayat presensi. Periksa koneksi internet kamu."));
      }
    );
  } catch {
    onError?.(new Error("Gagal menghubungkan ke layanan riwayat presensi."));
    return () => {};
  }
}

export function subscribeLeaveHistory(
  uid: string,
  onData: (leaves: LeaveRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!uid) {
    onData([]);
    return () => {};
  }

  try {
    const q = query(collection(db, "leaveRequests"), where("userId", "==", uid));

    return onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        try {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() ?? {}) } as LeaveRequest));
          list.sort((a: any, b: any) => {
            const timeA = getTimestampMillis(a.createdAt ?? a.waktuPengajuan);
            const timeB = getTimestampMillis(b.createdAt ?? b.waktuPengajuan);
            return timeB - timeA;
          });
          onData(list);
        } catch {
          onError?.(new Error("Gagal mengolah data riwayat izin."));
        }
      },
      (_err: FirestoreError) => {
        onError?.(new Error("Gagal memuat riwayat izin. Periksa koneksi internet kamu."));
      }
    );
  } catch {
    onError?.(new Error("Gagal menghubungkan ke layanan riwayat izin."));
    return () => {};
  }
}
