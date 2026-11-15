// Presensi (SRS presensi). SATU-SATUNYA jalur menulis presensi:
//   - checkIn        : praktikan presensi sendiri.
//   - checkInManual  : asisten pengampu mencatat presensi praktikan.
//   - resetPresensi / resetIzin : asisten mengembalikan status Hadir / Izin praktikan ke awal di Rekap. "Tidak hadir" TIDAK disimpan: dihitung di layar Rekap
//     untuk praktikan tanpa presensi dan tanpa izin setelah sesi ditutup / waktunya lewat.
// Format dokumen (harus sama dengan firestore.rules dan tipe `Attendance`):
//   attendances/{sessionId}_{uid} = { sessionId, kelasId, userId, nama, nim, waktuHadir }
//   Presensi oleh asisten menambah dua field: { manual: true, dicatatOleh: <uid asisten> }
// - ID deterministik + rules `update/delete: false` => satu presensi per praktikan per sesi, ditegakkan SERVER.
// - Rules juga memeriksa status sesi `dibuka` saat commit, jadi sesi yang ditutup di tengah proses tetap ditolak.
// - Transaksi di bawah hanya untuk memberi pesan error yang jelas; keamanan tetap di rules.
import {
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
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

export type ManualCheckInTarget = { id: string; nama: string; nim?: string };

/**
 * Asisten pengampu mencatat presensi seorang praktikan (mis. HP praktikan bermasalah).
 * - Hanya saat sesi Dibuka dan hanya untuk peserta kelas sesi tersebut (ditegakkan firestore.rules).
 * - ID dokumen sama dengan presensi biasa, jadi satu praktikan tetap hanya satu presensi per sesi:
 *   mencatat praktikan yang sudah hadir ditolak server (dokumen ada = update = ditolak).
 * - Waktu hadir = waktu server saat dicatat.
 * - `nama` dan `nim` HARUS persis sama dengan profil praktikan (dicek rules), jadi tidak di-trim di sini.
 */
export async function checkInManual(
  session: Session,
  praktikan: ManualCheckInTarget,
  asistenId: string
): Promise<CheckInResult> {
  if (!session?.id || !praktikan?.id || !asistenId) {
    return { ok: false, message: "Data sesi atau praktikan tidak valid." };
  }
  if (session.asistenId !== asistenId) {
    return { ok: false, message: "Hanya asisten pengampu sesi ini yang dapat mencatat presensi." };
  }
  if (session.status !== STATUS_SESI.DIBUKA) {
    return { ok: false, message: "Presensi hanya dapat dicatat saat sesi sedang dibuka." };
  }

  try {
    await withTimeout(
      setDoc(doc(db, "attendances", attendanceDocId(session.id, praktikan.id)), {
        sessionId: session.id,
        kelasId: session.kelasId,
        userId: praktikan.id,
        nama: praktikan.nama,
        nim: praktikan.nim ?? "",
        waktuHadir: serverTimestamp(),
        manual: true,
        dicatatOleh: asistenId,
      }),
      CHECKIN_TIMEOUT_MS
    );
    return { ok: true };
  } catch (error: any) {
    const code = getErrorCode(error);
    if (isTimeoutError(error) || code === "firestore/unavailable" || code === "firestore/deadline-exceeded") {
      return {
        ok: false,
        message:
          "Koneksi bermasalah. Presensi mungkin belum tercatat; periksa internet lalu cek rekap.",
      };
    }
    if (code === "firestore/permission-denied") {
      return {
        ok: false,
        message:
          "Presensi ditolak: praktikan sudah tercatat hadir, sesi baru saja ditutup, atau bukan peserta kelas ini.",
      };
    }
    return { ok: false, message: "Gagal mencatat presensi. Periksa koneksi internet lalu coba lagi." };
  }
}

// ─── Status manual oleh asisten (Rekap) ──────────────────────────────────────

type SesiAsisten = Pick<Session, "id" | "asistenId" | "status">;

/** Pastikan sesi milik asisten ini dan sedang Dibuka. Mengembalikan pesan error atau null. */
function cekSesiManual(session: SesiAsisten, asistenId: string): string | null {
  if (!session?.id || !asistenId) return "Data sesi tidak valid.";
  if (session.asistenId !== asistenId) {
    return "Hanya asisten pengampu sesi ini yang dapat mengubah status praktikan.";
  }
  if (session.status !== STATUS_SESI.DIBUKA) {
    return "Status praktikan hanya dapat diubah saat sesi sedang dibuka.";
  }
  return null;
}

function pesanGagalManual(error: unknown, aksi: string): CheckInResult {
  const code = getErrorCode(error);
  if (isTimeoutError(error) || code === "firestore/unavailable" || code === "firestore/deadline-exceeded") {
    return {
      ok: false,
      message: `Koneksi bermasalah. ${aksi} mungkin belum tersimpan; periksa internet lalu cek rekap.`,
    };
  }
  if (code === "firestore/permission-denied") {
    return {
      ok: false,
      message: `${aksi} ditolak: data praktikan sudah berubah, sesi baru saja ditutup, atau bukan peserta kelas ini.`,
    };
  }
  return { ok: false, message: `${aksi} gagal. Periksa koneksi internet lalu coba lagi.` };
}

/**
 * Kembalikan praktikan ke status awal untuk HADIR: hapus dokumen presensinya (mis. salah catat).
 * Setelah itu praktikan bisa presensi sendiri lagi. Hanya saat sesi Dibuka.
 */
export async function resetPresensi(
  session: SesiAsisten,
  praktikanId: string,
  asistenId: string
): Promise<CheckInResult> {
  const invalid = cekSesiManual(session, asistenId);
  if (invalid || !praktikanId) return { ok: false, message: invalid ?? "Data praktikan tidak valid." };

  try {
    await withTimeout(
      deleteDoc(doc(db, "attendances", attendanceDocId(session.id, praktikanId))),
      CHECKIN_TIMEOUT_MS
    );
    return { ok: true };
  } catch (error) {
    return pesanGagalManual(error, "Reset presensi");
  }
}

/**
 * Kembalikan praktikan ke status awal untuk IZIN.
 * Izin adalah ajuan praktikan (alasan & hasil AI miliknya), jadi TIDAK dihapus: statusnya
 * dikembalikan ke `menunggu` agar kembali masuk antrean tinjauan di tab Izin.
 */
export async function resetIzin(
  session: SesiAsisten,
  praktikanId: string,
  asistenId: string
): Promise<CheckInResult> {
  const invalid = cekSesiManual(session, asistenId);
  if (invalid || !praktikanId) return { ok: false, message: invalid ?? "Data praktikan tidak valid." };

  try {
    await withTimeout(
      updateDoc(doc(db, "leaveRequests", `${session.id}_${praktikanId}`), { status: "menunggu" }),
      CHECKIN_TIMEOUT_MS
    );
    return { ok: true };
  } catch (error) {
    return pesanGagalManual(error, "Reset izin");
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
