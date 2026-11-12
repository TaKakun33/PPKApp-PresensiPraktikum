// FILE MILIK PM — service Firestore untuk sesi, presensi, dan izin.
// Semua fungsi subscribe mengembalikan fungsi unsubscribe (panggil di useEffect cleanup).
// Koleksi Firestore:
//   sessions     : dokumen sesi (Session)
//   attendances  : dokumen presensi (Attendance)
//   leaveRequests: pengajuan izin (LeaveRequest)
// Bagian "KELOLA JADWAL" di akhir file ditambahkan Hadrian (feat/classsessioncrud, SRS-16).
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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

import type { StatusIzin, StatusSesi } from "../app/constants";
import { db } from "../app/firebase";
import type { Attendance, LeaveRequest, Profile, Session } from "../app/types";
import { formatTanggal } from "../utils/format";

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
  status: Exclude<StatusIzin, "menunggu">,
  catatanAsisten?: string
): Promise<void> {
  await updateDoc(doc(db, "leaveRequests", leaveId), {
    status,
    catatanAsisten: catatanAsisten?.trim() ?? "",
  });
}

// ─── KELOLA JADWAL (Hadrian, SRS-16) ──────────────────────────────────────────
// Format simpan: tanggal "2026-11-20", waktuMulai/waktuSelesai "08:00" (jam lokal lab).
// Jadwal hanya bisa diubah atau dihapus selama sesi masih Belum Dibuka.

export type SessionInput = Pick<
  Session,
  "praktikum" | "kelasId" | "tanggal" | "waktuMulai" | "waktuSelesai" | "ruangan"
>;

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

// "8.00" / "8:00" -> "08:00"
function rapikanJam(jam: string): string {
  const [h = "", m = ""] = jam.trim().replace(".", ":").split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function tanggalValid(tanggal: string): boolean {
  const cocok = POLA_TANGGAL.exec(tanggal);
  if (!cocok) return false;
  const [y, m, d] = cocok.slice(1).map(Number);
  const tgl = new Date(y, m - 1, d);
  return tgl.getFullYear() === y && tgl.getMonth() === m - 1 && tgl.getDate() === d;
}

/** Validasi dan rapikan input jadwal. Melempar Error berisi pesan siap tampil. */
export function validasiSesi(input: SessionInput): SessionInput {
  const data: SessionInput = {
    kelasId: input.kelasId,
    praktikum: input.praktikum.trim(),
    tanggal: input.tanggal.trim(),
    waktuMulai: rapikanJam(input.waktuMulai),
    waktuSelesai: rapikanJam(input.waktuSelesai),
    ruangan: input.ruangan.trim(),
  };
  if (!data.kelasId) throw new Error("Pilih kelas terlebih dahulu.");
  if (!data.praktikum) throw new Error("Nama praktikum harus diisi.");
  if (!tanggalValid(data.tanggal)) {
    throw new Error("Tanggal harus berformat TTTT-BB-HH, contoh 2026-11-20.");
  }
  if (!POLA_JAM.test(data.waktuMulai) || !POLA_JAM.test(data.waktuSelesai)) {
    throw new Error("Waktu harus berformat JJ:MM, contoh 08:00.");
  }
  if (data.waktuMulai >= data.waktuSelesai) {
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  }
  if (!data.ruangan) throw new Error("Ruangan harus diisi.");
  return data;
}

async function pastikanKelasMilik(kelasId: string, asistenId: string) {
  const snap = await getDoc(doc(db, "classes", kelasId));
  if (!snap.exists()) throw new Error("Kelas tidak ditemukan.");
  if (snap.data()?.asistenId !== asistenId) {
    throw new Error("Kamu hanya bisa membuat sesi untuk kelas yang kamu ampu.");
  }
}

async function getEditableSession(sessionId: string, asistenId: string) {
  const owned = await getOwnedSession(sessionId, asistenId);
  if (owned.sesi.status !== "belum_dibuka") {
    throw new Error("Jadwal tidak bisa diubah atau dihapus setelah sesi dibuka.");
  }
  return owned;
}

/** Tambah sesi baru (status Belum Dibuka). Mengembalikan id sesi. */
export async function createSession(asistenId: string, input: SessionInput): Promise<string> {
  const data = validasiSesi(input);
  await pastikanKelasMilik(data.kelasId, asistenId);

  const ref = doc(collection(db, "sessions"));
  const sesi: Omit<Session, "id"> = { ...data, asistenId, status: "belum_dibuka" };
  await setDoc(ref, sesi);
  return ref.id;
}

/** Ubah jadwal sesi. Hanya asisten pengampu dan hanya saat Belum Dibuka. */
export async function updateSession(
  sessionId: string,
  asistenId: string,
  input: SessionInput
): Promise<void> {
  const data = validasiSesi(input);
  const { ref } = await getEditableSession(sessionId, asistenId);
  await pastikanKelasMilik(data.kelasId, asistenId);
  await updateDoc(ref, data);
}

/** Hapus sesi. Ditolak jika sudah dibuka atau sudah ada pengajuan izin untuknya. */
export async function deleteSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref } = await getEditableSession(sessionId, asistenId);
  const izin = await getDocs(
    query(
      collection(db, "leaveRequests"),
      where("asistenId", "==", asistenId),
      where("sessionId", "==", sessionId),
      limit(1)
    )
  );
  if (!izin.empty) {
    throw new Error("Sesi ini sudah punya pengajuan izin, jadi tidak bisa dihapus.");
  }
  await deleteDoc(ref);
}

/** "2026-11-20" -> "20 Nov 2026". Format lain ditampilkan apa adanya. */
export function labelTanggal(tanggal: string): string {
  return tanggalValid(tanggal) ? formatTanggal(`${tanggal}T00:00:00`) : tanggal;
}

/** "08:00", "10:00" -> "08.00 - 10.00" */
export function labelWaktu(sesi: Pick<Session, "waktuMulai" | "waktuSelesai">): string {
  const fmt = (jam: string) => (jam ?? "").replace(":", ".");
  return `${fmt(sesi.waktuMulai)} - ${fmt(sesi.waktuSelesai)}`;
}

/** Urutkan sesi berdasarkan tanggal lalu waktu mulai (terdekat lebih dulu). */
export function urutkanSesi(list: Session[]): Session[] {
  return [...list].sort((a, b) =>
    `${a.tanggal} ${a.waktuMulai}`.localeCompare(`${b.tanggal} ${b.waktuMulai}`)
  );
}