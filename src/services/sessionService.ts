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
  writeBatch,
  type DocumentSnapshot,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "@react-native-firebase/firestore";

import { STATUS_IZIN } from "../lib/constants";
import type { StatusIzin, StatusSesi } from "../lib/constants";
import { db } from "../lib/firebase";
import type { Attendance, LeaveRequest, Profile, Session } from "../lib/types";
import { dataKodePresensi } from "./attendanceService";
import { formatTanggal } from "../utils/format";

/** Batas durasi sesi praktikum: 2 jam. */
export const BATAS_DURASI_MENIT = 120;

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

  // Batas klausa `in` Firestore adalah 30 item: kelas dipecah per 30 lalu hasilnya digabung.
  const potongan: string[][] = [];
  for (let i = 0; i < kelasIds.length; i += 30) potongan.push(kelasIds.slice(i, i + 30));

  const hasil = new Map<number, Session[]>();
  const unsubs = potongan.map((ids, i) =>
    onSnapshot(
      query(collection(db, "sessions"), where("kelasId", "in", ids)),
      (snap: QuerySnapshot) => {
        hasil.set(i, snap.docs.map((d) => mapDoc<Session>(d)));
        if (hasil.size === potongan.length) onData([...hasil.values()].flat());
      },
      (err: FirestoreError) => onError?.(err)
    )
  );
  return () => unsubs.forEach((u) => u());
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
 * Buka sesi (belum_dibuka → dibuka). Hanya asisten pengampu, dan hanya jika tidak ada sesi lain
 * miliknya yang sedang dibuka.
 * Throws jika tidak diizinkan atau Firestore gagal.
 */
export async function openSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref, sesi } = await getOwnedSession(sessionId, asistenId);
  if (sesi.status === "dibuka") throw new Error("Sesi sudah dibuka.");
  if (sesi.status === "ditutup") {
    throw new Error("Sesi yang sudah ditutup tidak dapat dibuka kembali.");
  }

  // Satu asisten hanya boleh punya SATU sesi dibuka dalam satu waktu.
  // Pemeriksaan di sisi aplikasi (rules Firestore tidak bisa melakukan query).
  const sedangDibuka = await getDocs(
    query(
      collection(db, "sessions"),
      where("asistenId", "==", asistenId),
      where("status", "==", "dibuka"),
      limit(2)
    )
  );
  const lain = sedangDibuka.docs.find((d) => d.id !== sessionId);
  if (lain) {
    const nama = (lain.data() as Partial<Session>).praktikum ?? "lain";
    throw new Error(`Sesi "${nama}" masih dibuka. Tutup sesi tersebut sebelum membuka sesi lain.`);
  }

  // Sesi dibuka dan kode unik presensinya dibuat dalam satu batch (atomik): sesi yang dibuka
  // selalu punya kode. Kode disimpan di koleksi terpisah karena dokumen sesi bisa dibaca praktikan.
  const batch = writeBatch(db);
  batch.update(ref, { status: "dibuka" as StatusSesi, openedAt: serverTimestamp() });
  batch.set(doc(db, "sessionCodes", sessionId), dataKodePresensi(sessionId, asistenId));
  await batch.commit();
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
  return subscribeCollectionWhere<Attendance>(
    "attendances",
    "sessionId",
    sessionId,
    (items) => onData(items.map(normalisasiPresensi)),
    onError
  );
}

/**
 * Dokumen presensi lama (sebelum format disatukan) memakai `name` / `checkedInAt`.
 * Dinormalkan ke `nama` / `waktuHadir` supaya rekap tetap terbaca untuk data lama.
 */
export function normalisasiPresensi(item: Attendance): Attendance {
  const legacy = item as Attendance & { name?: string; checkedInAt?: unknown };
  return {
    ...item,
    nama: item.nama ?? legacy.name ?? "",
    waktuHadir: item.waktuHadir ?? legacy.checkedInAt ?? null,
  };
}

/** Real-time listener presensi milik satu praktikan (untuk riwayat). */
export function subscribeMyAttendances(
  userId: string,
  onData: (attendances: Attendance[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribeCollectionWhere<Attendance>(
    "attendances",
    "userId",
    userId,
    (items) => onData(items.map(normalisasiPresensi)),
    onError
  );
}

// Catatan: penulisan presensi HANYA lewat attendanceService.checkIn (satu format dokumen).

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

// Pengajuan izin (sisi praktikan) ada di leaveService.submitLeave: ID dokumen deterministik + klasifikasi AI.

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
    catatanAsisten: (catatanAsisten ?? "").trim().slice(0, 500),
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

/** Selisih waktu dalam menit untuk jam berformat "HH:MM". */
export function durasiMenit(mulai: string, selesai: string): number {
  const keMenit = (jam: string) => {
    const [h = "0", m = "0"] = jam.split(":");
    return Number(h) * 60 + Number(m);
  };
  return keMenit(selesai) - keMenit(mulai);
}

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
  if (durasiMenit(data.waktuMulai, data.waktuSelesai) > BATAS_DURASI_MENIT) {
    throw new Error(`Durasi sesi praktikum maksimal ${BATAS_DURASI_MENIT / 60} jam.`);
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
  const hariIni = new Date();
  const awalHariIni = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  const [y, m, d] = data.tanggal.split("-").map(Number);
  if (new Date(y, m - 1, d) < awalHariIni) {
    throw new Error("Tanggal sesi tidak boleh sebelum hari ini.");
  }
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