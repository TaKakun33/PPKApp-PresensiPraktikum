// FILE MILIK PM — service Firestore untuk sesi, presensi, dan izin.
// Semua fungsi subscribe mengembalikan fungsi unsubscribe (panggil di useEffect cleanup).
// Koleksi Firestore:
//   sessions     : dokumen sesi (Session)
//   attendances  : dokumen presensi (Attendance)
//   leaveRequests: pengajuan izin (LeaveRequest)
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentSnapshot,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "@react-native-firebase/firestore";

import { STATUS_IZIN } from "../app/constants";
import type { StatusIzin, StatusSesi } from "../app/constants";
import { db } from "../app/firebase";
import type { Attendance, LeaveRequest, Profile, Session } from "../app/types";

export type LeaveClassifier = (alasan: string) => Promise<string | null> | string | null;

// ─── helper ───────────────────────────────────────────────────────────────────
function mapDoc<T>(snap: QueryDocumentSnapshot | DocumentSnapshot): T {
  return { id: snap.id, ...(snap.data() ?? {}) } as T;
}

function subscribeCollectionWhere<T>(
  collectionName: string,
  field: string,
  value: string,
  onData: (items: T[]) => void,
  onError?: (e: Error) => void
): () => void {
  const q = query(collection(db, collectionName), where(field, "==", value));
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => onData(snap.docs.map((d) => mapDoc<T>(d))),
    (err: FirestoreError) => onError?.(err)
  );
}

async function getOwnedSession(sessionId: string, asistenId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sesi tidak ditemukan.");

  const sesi = snap.data() as Session;
  if (sesi.asistenId !== asistenId) {
    throw new Error("Hanya asisten pengampu yang dapat mengubah sesi ini.");
  }
  return { ref, sesi };
}

// ─── SESI ─────────────────────────────────────────────────────────────────────

/**
 * Real-time listener sesi milik user.
 * - Praktikan : sesi di kelas yang dia ikuti (berdasarkan field kelasId vs kelasIds profil).
 * - Asisten   : sesi yang asistenId-nya cocok dengan uid.
 * Panggil unsubscribe() saat komponen unmount.
 */
export function subscribeSessions(
  profile: Profile,
  onData: (sessions: Session[]) => void,
  onError?: (e: Error) => void
): () => void {
  if (profile.role === "asisten") {
    return subscribeCollectionWhere<Session>("sessions", "asistenId", profile.id, onData, onError);
  }

  const kelasIds = profile.kelasIds ?? [];
  if (kelasIds.length === 0) {
    // Hindari query `in` dengan array kosong karena Firestore melempar error.
    onData([]);
    return () => {};
  }

  // Batas maksimal klausa `in` Firestore adalah 30 item.
  const q = query(collection(db, "sessions"), where("kelasId", "in", kelasIds.slice(0, 30)));
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => onData(snap.docs.map((d) => mapDoc<Session>(d))),
    (err: FirestoreError) => onError?.(err)
  );
}

/** Ambil satu sesi (satu kali, bukan listener). */
export async function getSession(sessionId: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, "sessions", sessionId));
  return snap.exists() ? mapDoc<Session>(snap) : null;
}

/** Real-time listener satu sesi (untuk halaman detail). */
export function subscribeSession(
  sessionId: string,
  onData: (session: Session | null) => void,
  onError?: (e: Error) => void
): () => void {
  return onSnapshot(
    doc(db, "sessions", sessionId),
    (snap: DocumentSnapshot) => onData(snap.exists() ? mapDoc<Session>(snap) : null),
    (err: FirestoreError) => onError?.(err)
  );
}

/**
 * Buka sesi (belum_dibuka → dibuka). Hanya asisten pengampu.
 * Throws jika tidak diizinkan atau Firestore gagal.
 */
export async function openSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref, sesi } = await getOwnedSession(sessionId, asistenId);
  if (sesi.status === "dibuka") throw new Error("Sesi sudah dibuka.");
  if (sesi.status === "ditutup") {
    throw new Error("Sesi yang sudah ditutup tidak dapat dibuka kembali.");
  }

  await updateDoc(ref, { status: "dibuka" as StatusSesi, openedAt: serverTimestamp() });
}

/**
 * Tutup sesi (dibuka → ditutup). Hanya asisten pengampu.
 */
export async function closeSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref, sesi } = await getOwnedSession(sessionId, asistenId);
  if (sesi.status !== "dibuka") {
    throw new Error("Hanya sesi yang sedang dibuka yang bisa ditutup.");
  }

  await updateDoc(ref, { status: "ditutup" as StatusSesi, closedAt: serverTimestamp() });
}

// ─── PRESENSI ─────────────────────────────────────────────────────────────────

/** Real-time listener semua presensi satu sesi (untuk rekap asisten). */
export function subscribeAttendances(
  sessionId: string,
  onData: (attendances: Attendance[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribeCollectionWhere<Attendance>("attendances", "sessionId", sessionId, onData, onError);
}

/** Real-time listener presensi milik satu praktikan (untuk riwayat). */
export function subscribeMyAttendances(
  userId: string,
  onData: (attendances: Attendance[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribeCollectionWhere<Attendance>("attendances", "userId", userId, onData, onError);
}

/**
 * Simpan presensi ke Firestore. ID deterministik: att-{sessionId}-{userId}.
 * Melempar error jika sudah presensi pada sesi yang sama (duplikat dicegah).
 */
export async function checkIn(
  profile: Profile,
  session: Session
): Promise<Attendance> {
  if (profile.role !== "praktikan") {
    throw new Error("Hanya praktikan yang dapat melakukan presensi.");
  }
  if (session.status !== "dibuka") {
    throw new Error(
      session.status === "belum_dibuka"
        ? "Sesi belum dibuka oleh asisten."
        : "Sesi sudah ditutup."
    );
  }

  const attId = `att-${session.id}-${profile.id}`;
  const ref = doc(db, "attendances", attId);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Kamu sudah presensi pada sesi ini.");

  const attendance: Omit<Attendance, "id"> = {
    sessionId: session.id,
    kelasId: session.kelasId,
    userId: profile.id,
    nama: profile.nama,
    nim: profile.nim ?? "",
    waktuHadir: serverTimestamp(),
  };
  await setDoc(ref, attendance);
  return { id: attId, ...attendance };
}

// ─── IZIN ─────────────────────────────────────────────────────────────────────

/** Real-time listener pengajuan izin milik satu praktikan. */
export function subscribeMyLeaveRequests(
  userId: string,
  onData: (requests: LeaveRequest[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribeCollectionWhere<LeaveRequest>("leaveRequests", "userId", userId, onData, onError);
}

/** Real-time listener semua izin di kelas yang diampu asisten. */
export function subscribeLeaveRequestsForAsisten(
  asistenId: string,
  onData: (requests: LeaveRequest[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribeCollectionWhere<LeaveRequest>(
    "leaveRequests",
    "asistenId",
    asistenId,
    onData,
    onError
  );
}

async function runLocalClassifier(
  alasan: string,
  classifyReason?: LeaveClassifier
): Promise<{ kategoriAI: string | null; aiStatus: "berhasil" | "gagal" }> {
  if (!classifyReason) return { kategoriAI: null, aiStatus: "gagal" };

  try {
    const raw = await classifyReason(alasan);
    const kategoriAI = raw?.trim() || null;
    return {
      kategoriAI,
      aiStatus: kategoriAI ? "berhasil" : "gagal",
    };
  } catch {
    // Model AI lokal gagal — pengajuan izin tetap tersimpan tanpa kategori.
    return { kategoriAI: null, aiStatus: "gagal" };
  }
}

/**
 * Ajukan izin dari praktikan. Menyimpan ke Firestore + menjalankan klasifikasi AI lokal (opsional).
 * Model AI hanya memberi kategori — tidak menentukan diterima/ditolak.
 * @param classifyReason Fungsi klasifikasi AI lokal yang sudah dipersiapkan.
 */
export async function submitLeaveRequest(
  profile: Profile,
  session: Session,
  alasan: string,
  classifyReason?: LeaveClassifier
): Promise<LeaveRequest> {
  if (profile.role !== "praktikan") {
    throw new Error("Hanya praktikan yang dapat mengajukan izin.");
  }

  const trimmedReason = alasan.trim();
  if (!trimmedReason) {
    throw new Error("Alasan izin harus diisi.");
  }

  const docRef = doc(collection(db, "leaveRequests"));
  const { kategoriAI, aiStatus } = await runLocalClassifier(trimmedReason, classifyReason);

  const leave: Omit<LeaveRequest, "id"> = {
    sessionId: session.id,
    kelasId: session.kelasId,
    asistenId: session.asistenId,
    praktikum: session.praktikum,
    userId: profile.id,
    nama: profile.nama,
    nim: profile.nim ?? "",
    alasan: trimmedReason,
    kategoriAI,
    aiStatus,
    status: "menunggu",
  };

  await setDoc(docRef, leave);
  return { id: docRef.id, ...leave };
}

/**
 * Asisten menerima atau menolak pengajuan izin.
 */
export async function updateLeaveStatus(
  leaveId: string,
  asistenId: string,
  status: Exclude<StatusIzin, "menunggu">,
  catatanAsisten?: string
): Promise<void> {
  const ref = doc(db, "leaveRequests", leaveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Pengajuan izin tidak ditemukan.");

  const request = snap.data() as LeaveRequest;
  if (request.asistenId !== asistenId) {
    throw new Error("Hanya asisten pengampu yang dapat meninjau pengajuan ini.");
  }
  if (request.status !== STATUS_IZIN.MENUNGGU) {
    throw new Error("Pengajuan izin ini sudah ditinjau.");
  }

  await updateDoc(ref, {
    status,
    catatanAsisten: catatanAsisten?.trim() ?? "",
  });
}