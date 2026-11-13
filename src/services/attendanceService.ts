import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type FirestoreError,
} from "@react-native-firebase/firestore";

import { db } from "../app/firebase";
import type { Session } from "../app/types";

export type CheckInUser = {
  uid?: string;
  id?: string;
  name?: string;
  nama?: string;
  nim?: string;
};

export type CheckInResult =
  | { ok: true }
  | { ok: false; message: string };

export async function checkIn(
  sessionId: string,
  user: CheckInUser
): Promise<CheckInResult> {
  const uid = user?.uid || user?.id;
  const name = user?.name || user?.nama || "";
  const nim = user?.nim || "";

  if (!sessionId || !uid) {
    return { ok: false, message: "ID sesi atau identitas pengguna tidak valid." };
  }

  try {
    const sessionRef = doc(db, "sessions", sessionId);
    const attendanceRef = doc(db, "attendances", `${sessionId}_${uid}`);

    await runTransaction(db, async (transaction: any) => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) {
        throw new Error("SESI_NOT_FOUND");
      }

      const sessionData = sessionSnap.data() as Partial<Session> | undefined;
      const statusStr = String(sessionData?.status ?? "");
      if (statusStr !== "dibuka" && statusStr !== "Dibuka") {
        throw new Error("SESI_NOT_OPEN");
      }

      const attSnap = await transaction.get(attendanceRef);
      if (attSnap.exists()) {
        throw new Error("ALREADY_ATTENDED");
      }

      transaction.set(attendanceRef, {
        sessionId,
        userId: uid,
        name,
        nim,
        checkedInAt: serverTimestamp(),
      });
    });

    return { ok: true };
  } catch (error: any) {
    const msg = error?.message || "";
    if (msg.includes("SESI_NOT_FOUND")) {
      return { ok: false, message: "Sesi praktikum tidak ditemukan." };
    }
    if (msg.includes("SESI_NOT_OPEN")) {
      return { ok: false, message: "Sesi praktikum belum dibuka atau sudah ditutup." };
    }
    if (msg.includes("ALREADY_ATTENDED")) {
      return { ok: false, message: "Kamu sudah melakukan presensi pada sesi ini." };
    }
    return {
      ok: false,
      message: "Gagal melakukan presensi. Periksa koneksi internet atau izin akun kamu.",
    };
  }
}

export function subscribeCheckInState(
  sessionId: string,
  uid: string,
  onChange: (state: { session: Session | null; attended: boolean }) => void,
  onError?: (err: Error) => void
): () => void {
  if (!sessionId || !uid) {
    onError?.(new Error("Parameter sessionId dan uid wajib diisi."));
    return () => {};
  }

  let sessionReady = false;
  let attReady = false;
  let currentSession: Session | null = null;
  let currentAttended = false;

  const sessionRef = doc(db, "sessions", sessionId);
  const attRef = doc(db, "attendances", `${sessionId}_${uid}`);

  const emitIfReady = () => {
    if (sessionReady && attReady) {
      onChange({ session: currentSession, attended: currentAttended });
    }
  };

  const unsubSession = onSnapshot(
    sessionRef,
    (snap: DocumentSnapshot) => {
      sessionReady = true;
      currentSession = snap.exists() ? ({ id: snap.id, ...(snap.data() ?? {}) } as Session) : null;
      emitIfReady();
    },
    (_err: FirestoreError) => {
      onError?.(new Error("Gagal memuat status sesi praktikum. Periksa koneksi internet kamu."));
    }
  );

  const unsubAttendance = onSnapshot(
    attRef,
    (snap: DocumentSnapshot) => {
      attReady = true;
      currentAttended = snap.exists();
      emitIfReady();
    },
    (_err: FirestoreError) => {
      onError?.(new Error("Gagal memuat status presensi. Periksa koneksi internet kamu."));
    }
  );

  return () => {
    unsubSession();
    unsubAttendance();
  };
}
