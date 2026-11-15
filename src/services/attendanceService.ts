// Presensi praktikan (SRS presensi). SATU-SATUNYA jalur menulis presensi.
// Format dokumen (harus sama dengan firestore.rules dan tipe `Attendance`):
//   attendances/{sessionId}_{uid} = { sessionId, kelasId, userId, nama, nim, waktuHadir }
// - ID deterministik + rules `update/delete: false` => satu presensi per praktikan per sesi, ditegakkan SERVER.
// - Rules juga memeriksa status sesi `dibuka` saat commit, jadi sesi yang ditutup di tengah proses tetap ditolak.
// - Transaksi di bawah hanya untuk memberi pesan error yang jelas; keamanan tetap di rules.
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type FirestoreError,
} from "@react-native-firebase/firestore";

import { STATUS_SESI } from "../lib/constants";
import { db } from "../lib/firebase";
import type { Session } from "../lib/types";
import { getErrorCode, isTimeoutError, withTimeout } from "./serviceUtils";

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

const CHECKIN_TIMEOUT_MS = 12000;

/** ID dokumen presensi. Harus sama dengan pola di firestore.rules. */
export function attendanceDocId(sessionId: string, uid: string): string {
  return `${sessionId}_${uid}`;
}

export async function checkIn(
  sessionId: string,
  user: CheckInUser
): Promise<CheckInResult> {
  const uid = user?.uid || user?.id;
  const nama = (user?.nama || user?.name || "").trim();
  const nim = user?.nim || "";

  if (!sessionId || !uid) {
    return { ok: false, message: "ID sesi atau identitas pengguna tidak valid." };
  }

  try {
    const sessionRef = doc(db, "sessions", sessionId);
    const attendanceRef = doc(db, "attendances", attendanceDocId(sessionId, uid));

    await withTimeout(
      runTransaction(db, async (transaction: any) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) {
          throw new Error("SESI_NOT_FOUND");
        }

        const sessionData = sessionSnap.data() as Partial<Session> | undefined;
        if (sessionData?.status !== STATUS_SESI.DIBUKA) {
          throw new Error("SESI_NOT_OPEN");
        }

        const attSnap = await transaction.get(attendanceRef);
        if (attSnap.exists()) {
          throw new Error("ALREADY_ATTENDED");
        }

        transaction.set(attendanceRef, {
          sessionId,
          kelasId: sessionData?.kelasId ?? "",
          userId: uid,
          nama,
          nim,
          waktuHadir: serverTimestamp(),
        });
      }),
      CHECKIN_TIMEOUT_MS
    );

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

    const code = getErrorCode(error);
    if (isTimeoutError(error) || code === "firestore/unavailable" || code === "firestore/deadline-exceeded") {
      return {
        ok: false,
        message:
          "Koneksi bermasalah. Presensi mungkin belum tercatat; periksa internet lalu cek status presensimu.",
      };
    }
    if (code === "firestore/permission-denied") {
      return {
        ok: false,
        message:
          "Presensi ditolak: sesi mungkin baru saja ditutup, atau kamu bukan peserta kelas ini.",
      };
    }
    return {
      ok: false,
      message: "Gagal melakukan presensi. Periksa koneksi internet lalu coba lagi.",
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
  const attRef = doc(db, "attendances", attendanceDocId(sessionId, uid));

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
