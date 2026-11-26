// FILE MILIK PM — service Firestore untuk sesi, presensi, dan izin.
// Semua fungsi subscribe mengembalikan fungsi unsubscribe (panggil di useEffect cleanup).
// Koleksi Firestore:
//   sessions     : dokumen sesi (Session)
//   attendances  : dokumen presensi (Attendance)
//   leaveRequests: pengajuan izin (LeaveRequest)
//   labBookings  : booking lab per slot (lihat jadwalService)
// Sesi milik KELAS: semua asisten pengampu kelas (maks. 2) bisa membuka, menutup, dan mengubahnya,
// dan karena keduanya mendengarkan dokumen yang sama, status sesi selalu sama di kedua perangkat.
// Bagian "KELOLA JADWAL" di akhir file ditambahkan Hadrian (feat/classsessioncrud, SRS-16).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
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
import type { Attendance, ClassDoc, LeaveRequest, Profile, Session } from "../lib/types";
import { dataKodePresensi } from "./attendanceService";
import { BATAS_LEWAT_SESI_DIBUKA_MS } from "../utils/aktivitasLab";
import { formatTanggal } from "../utils/format";
import {
  asistenIdsKelas,
  isTertunda,
  labelKelas,
  subscribeClassesForAsisten,
  subscribePerKelasAsisten,
  tungguTulis,
} from "./classService";
import {
  bookingId,
  cekBentrokSesi,
  getLab,
  getSlot,
  hariIniWib,
  slotSudahLewat,
  waktuWib,
} from "./jadwalService";
// Zhafran (feat/push-notif, SRS-35): kirim push notification saat sesi dibuka, jadwal diubah, izin diputuskan.
import { kirimNotifikasi } from "./notificationService";
import { withTimeout } from "./serviceUtils";

/** Durasi setiap sesi praktikum: tepat 2 jam (satu slot). */
export const DURASI_SESI_MENIT = 120;

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

/** Kelas yang diampu asisten ini. Melempar Error jika kelas tidak ada / bukan pengampunya. */
async function getKelasDiampu(kelasId: string, asistenId: string): Promise<ClassDoc> {
  const snap = await getDoc(doc(db, "classes", kelasId));
  if (!snap.exists()) throw new Error("Kelas tidak ditemukan.");
  const d = (snap.data() ?? {}) as Partial<ClassDoc>;
  const asistenIds = asistenIdsKelas(d);
  if (!asistenIds.includes(asistenId)) {
    throw new Error("Hanya asisten pengampu kelas ini yang dapat mengelola sesinya.");
  }
  return {
    id: kelasId,
    namaKelas: d.namaKelas ?? "",
    praktikum: d.praktikum ?? "",
    asistenId: d.asistenId ?? "",
    asistenIds,
    pesertaIds: Array.isArray(d.pesertaIds) ? d.pesertaIds : [],
  };
}

async function getOwnedSession(sessionId: string, asistenId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sesi tidak ditemukan.");

  const sesi = { ...(snap.data() as Session), id: sessionId };
  await getKelasDiampu(sesi.kelasId, asistenId);
  return { ref, sesi };
}

// ─── SESI ─────────────────────────────────────────────────────────────────────

/**
 * Real-time listener sesi milik user.
 * - Praktikan : sesi di kelas yang dia ikuti (berdasarkan field kelasId vs kelasIds profil).
 * - Asisten   : sesi semua kelas yang dia ampu (sebagai pembuat atau partner).
 * Panggil unsubscribe() saat komponen unmount.
 */
export function subscribeSessions(
  profile: Profile,
  onData: (sessions: Session[]) => void,
  onError?: (e: Error) => void
): () => void {
  if (profile.role === "asisten") {
    return subscribePerKelasAsisten<Session>(
      profile.id,
      (kelasId, kirim, gagal) => subscribeCollectionWhere<Session>("sessions", "kelasId", kelasId, kirim, gagal),
      onData,
      onError
    );
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

/** Kelas yang diampu asisten (sekali baca). */
function getKelasAsisten(asistenId: string): Promise<ClassDoc[]> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | null = null;
    let selesai = false;
    const akhiri = () => {
      selesai = true;
      unsub?.();
    };
    unsub = subscribeClassesForAsisten(
      asistenId,
      (classes) => {
        akhiri();
        resolve(classes);
      },
      (e) => {
        akhiri();
        reject(e);
      }
    );
    if (selesai) unsub();
  });
}

/**
 * Sesi hanya bisa dibuka pada jam yang dibooking: [tanggal jam mulai, tanggal jam selesai) WIB
 * (evaluasi Sprint 2 poin 11). Aturan yang sama ditegakkan firestore.rules dengan waktu server.
 * Mengembalikan pesan penolakan, atau null jika sekarang boleh dibuka.
 */
export function alasanTidakBisaDibuka(sesi: Pick<Session, "tanggal" | "waktuMulai" | "waktuSelesai">): string | null {
  const mulai = waktuWib(sesi.tanggal, sesi.waktuMulai);
  const selesai = waktuWib(sesi.tanggal, sesi.waktuSelesai);
  if (Number.isNaN(mulai) || Number.isNaN(selesai)) return "Jadwal sesi tidak valid.";
  const sekarang = Date.now();
  const jam = `${labelTanggal(sesi.tanggal)} ${labelWaktu(sesi)} WIB`;
  if (sekarang < mulai) return `Sesi baru bisa dibuka pada jam yang dibooking (${jam}).`;
  if (sekarang >= selesai) return `Jam sesi sudah lewat (${jam}). Ubah jadwal atau buat sesi baru.`;
  return null;
}

/**
 * Buka sesi (belum_dibuka → dibuka). Hanya asisten pengampu kelas, hanya pada jam yang dibooking,
 * dan hanya jika tidak ada sesi lain di kelas-kelas yang dia ampu yang sedang dibuka.
 * Throws jika tidak diizinkan atau Firestore gagal.
 */
/**
 * Kirim notifikasi TANPA ditunggu. Saat sinyal jelek, penulisan kotak masuk dan panggilan Expo Push
 * bisa menggantung lama; aksi asisten (buka sesi, ubah jadwal, putuskan izin) tidak boleh ikut
 * tertahan. Gagal kirim cukup dicatat di log.
 */
function kirimDiLatar(label: string, kerja: () => Promise<void>): void {
  kerja().catch((e) => console.error(`[${label}] Gagal kirim notifikasi:`, e));
}

export async function openSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref, sesi } = await getOwnedSession(sessionId, asistenId);
  if (sesi.status === "dibuka") throw new Error("Sesi sudah dibuka.");
  if (sesi.status === "ditutup") {
    throw new Error("Sesi yang sudah ditutup tidak dapat dibuka kembali.");
  }
  const alasan = alasanTidakBisaDibuka(sesi);
  if (alasan) throw new Error(alasan);

  // Satu asisten hanya boleh punya SATU sesi dibuka dalam satu waktu (termasuk sesi yang dibuka
  // partnernya di kelas lain yang juga dia ampu). Pemeriksaan di aplikasi: rules tidak bisa query.
  for (const kelas of await getKelasAsisten(asistenId)) {
    const sedangDibuka = await getDocs(
      query(
        collection(db, "sessions"),
        where("kelasId", "==", kelas.id),
        where("status", "==", "dibuka"),
        limit(2)
      )
    );
    const lain = sedangDibuka.docs.find((d) => d.id !== sessionId);
    if (lain) {
      throw new Error(
        `Sesi ${labelKelas(kelas)} (${kelas.praktikum}) masih dibuka. Tutup sesi tersebut sebelum membuka sesi lain.`
      );
    }
  }

  // Sesi dibuka dan kode unik presensinya dibuat dalam satu batch (atomik): sesi yang dibuka
  // selalu punya kode. Kode disimpan di koleksi terpisah karena dokumen sesi bisa dibaca praktikan.
  const batch = writeBatch(db);
  batch.update(ref, { status: "dibuka" as StatusSesi, openedAt: serverTimestamp() });
  batch.set(doc(db, "sessionCodes", sessionId), dataKodePresensi({ ...sesi, id: sessionId }, asistenId));
  await batch.commit();

  // SRS-35: Kirim notifikasi ke seluruh praktikan kelas saat sesi dibuka.
  // Gagal kirim notif tidak boleh mengganggu alur buka sesi (dikirim di latar, tidak ditunggu).
  kirimDiLatar("openSession", async () => {
    const kelasSnap = await getDoc(doc(db, "classes", sesi.kelasId));
    const pesertaIds = (kelasSnap.data()?.pesertaIds ?? []) as string[];
    if (pesertaIds.length > 0) {
      await kirimNotifikasi(
        pesertaIds,
        "Sesi Dibuka! 🔓",
        `Sesi ${sesi.praktikum} di ${sesi.ruangan} sudah dibuka. Segera presensi!`,
        { layar: "detail-sesi", id: sessionId },
      );
    }
  });
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

/** Sesi `dibuka` yang lupa ditutup: sudah lewat 1 jam dari jam selesai jadwalnya. */
export function sesiLupaDitutup(sesi: Pick<Session, "status" | "tanggal" | "waktuSelesai">, sekarang: number = Date.now()): boolean {
  if (sesi.status !== "dibuka") return false;
  const selesai = waktuWib(sesi.tanggal, sesi.waktuSelesai);
  return !Number.isNaN(selesai) && sekarang >= selesai + BATAS_LEWAT_SESI_DIBUKA_MS;
}

/**
 * Tutup otomatis sesi `dibuka` yang sudah lewat 1 jam dari jam selesai. Dipanggil dari layar asisten
 * (tidak ada server yang menjalankannya), jadi baru berjalan saat ada asisten pengampu membuka aplikasi.
 * Gagal menulis (offline, bukan pengampu, sudah ditutup perangkat lain) diabaikan; dicoba lagi pada pemanggilan berikutnya.
 */
export async function tutupSesiLupaDitutup(sesi: Session[]): Promise<void> {
  await Promise.all(
    sesi
      .filter((item) => sesiLupaDitutup(item))
      .map((item) =>
        withTimeout(
          updateDoc(doc(db, "sessions", item.id), { status: "ditutup" as StatusSesi, closedAt: serverTimestamp() }),
          15000
        ).catch(() => {})
      )
  );
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

/** Real-time listener semua izin di kelas yang diampu asisten (pembuat maupun partner). */
export function subscribeLeaveRequestsForAsisten(
  asistenId: string,
  onData: (requests: LeaveRequest[]) => void,
  onError?: (e: Error) => void
): () => void {
  return subscribePerKelasAsisten<LeaveRequest>(
    asistenId,
    (kelasId, kirim, gagal) =>
      subscribeCollectionWhere<LeaveRequest>("leaveRequests", "kelasId", kelasId, kirim, gagal),
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
  await getKelasDiampu(request.kelasId, asistenId);
  if (request.status !== STATUS_IZIN.MENUNGGU) {
    throw new Error("Pengajuan izin ini sudah ditinjau.");
  }

  await updateDoc(ref, {
    status,
    catatanAsisten: (catatanAsisten ?? "").trim().slice(0, 500),
  });

  // SRS-35: Kirim notifikasi ke praktikan pengaju saat izin diputuskan.
  // Gagal kirim notif tidak boleh mengganggu alur keputusan izin (dikirim di latar, tidak ditunggu).
  kirimDiLatar("updateLeaveStatus", async () => {
    const statusLabel = status === STATUS_IZIN.DITERIMA ? "Diterima ✅" : "Ditolak ❌";
    await kirimNotifikasi(
      [request.userId],
      `Izin ${statusLabel}`,
      `Pengajuan izinmu untuk sesi ${request.praktikum} telah ${status}.`,
      { layar: "izin", id: leaveId, penting: true },
    );
  });
}

// ─── KELOLA JADWAL (Hadrian, SRS-16; disesuaikan evaluasi Sprint 2) ──────────
// Format simpan: tanggal "2026-11-20", waktuMulai/waktuSelesai "10:10" (jam WIB, dari slot).
// Sesi wajib memakai lab (koleksi labs) dan slot tetap 2 jam. Setiap sesi memegang satu dokumen
// labBookings/{lab}_{tanggal}_{slot} yang ditulis dalam batch yang sama: lab tidak bisa dibooking
// dua sesi pada slot yang sama (ditegakkan server). Jadwal hanya bisa diubah selama Belum Dibuka.

export type SessionInput = { kelasId: string; tanggal: string; labKode: string; slot: number };

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

function tanggalValid(tanggal: string): boolean {
  const cocok = POLA_TANGGAL.exec(tanggal);
  if (!cocok) return false;
  const [y, m, d] = cocok.slice(1).map(Number);
  const tgl = new Date(y, m - 1, d);
  return tgl.getFullYear() === y && tgl.getMonth() === m - 1 && tgl.getDate() === d;
}

/** Validasi input jadwal. Melempar Error berisi pesan siap tampil. */
export function validasiSesi(input: SessionInput): SessionInput {
  const data: SessionInput = {
    kelasId: input.kelasId,
    tanggal: input.tanggal.trim(),
    labKode: input.labKode,
    slot: input.slot,
  };
  if (!data.kelasId) throw new Error("Pilih kelas terlebih dahulu.");
  if (!tanggalValid(data.tanggal)) {
    throw new Error("Tanggal harus berformat TTTT-BB-HH, contoh 2026-11-20.");
  }
  if (!data.labKode) throw new Error("Pilih ruangan lab.");
  if (!getSlot(data.slot)) throw new Error("Pilih jam sesi.");
  return data;
}

function tolakJadwalLewat(tanggal: string, slot: number) {
  if (tanggal < hariIniWib()) throw new Error("Tanggal sesi tidak boleh sebelum hari ini.");
  const s = getSlot(slot);
  if (s && slotSudahLewat(tanggal, s)) throw new Error("Jam sesi tersebut sudah lewat. Pilih jam lain.");
}

async function getEditableSession(sessionId: string, asistenId: string) {
  const owned = await getOwnedSession(sessionId, asistenId);
  if (owned.sesi.status !== "belum_dibuka") {
    throw new Error("Jadwal tidak bisa diubah atau dihapus setelah sesi dibuka.");
  }
  return owned;
}

/** Siapkan isi dokumen sesi: cek kelas, lab, bentrok, lalu turunkan praktikum/ruangan/jam. */
async function siapkanJadwal(asistenId: string, data: SessionInput, kecualiSessionId?: string) {
  const kelas = await getKelasDiampu(data.kelasId, asistenId);
  const lab = await getLab(data.labKode);
  if (!lab) throw new Error(`Lab ${data.labKode} tidak ada di daftar lab.`);
  const slot = getSlot(data.slot)!;
  await cekBentrokSesi({
    kelasId: kelas.id,
    pesertaIds: kelas.pesertaIds,
    labKode: lab.kode,
    tanggal: data.tanggal,
    slot: slot.slot,
    kecualiSessionId,
  });
  return {
    jadwal: {
      kelasId: kelas.id,
      praktikum: kelas.praktikum,
      tanggal: data.tanggal,
      waktuMulai: slot.mulai,
      waktuSelesai: slot.selesai,
      labKode: lab.kode,
      ruangan: lab.nama,
      slot: slot.slot,
    },
    booking: { kelasId: kelas.id, labKode: lab.kode, tanggal: data.tanggal, slot: slot.slot },
  };
}

/** Pesan untuk penolakan server saat menyimpan jadwal (biasanya lab baru saja dibooking orang lain). */
function pesanSimpanJadwal(e: unknown): never {
  if (isTertunda(e)) throw e;
  const code = String((e as { code?: unknown } | null)?.code ?? "");
  if (code.includes("permission-denied")) {
    throw new Error(
      "Jadwal ditolak server: lab pada jam tersebut baru saja dibooking sesi lain, atau kamu bukan pengampu kelas ini."
    );
  }
  throw e;
}

/** Tambah sesi baru (status Belum Dibuka). Mengembalikan id sesi. */
export async function createSession(asistenId: string, input: SessionInput): Promise<string> {
  const data = validasiSesi(input);
  tolakJadwalLewat(data.tanggal, data.slot);
  const { jadwal, booking } = await siapkanJadwal(asistenId, data);

  const ref = doc(collection(db, "sessions"));
  const sesi: Omit<Session, "id"> = { ...jadwal, asistenId, status: "belum_dibuka" };
  const batch = writeBatch(db);
  batch.set(ref, sesi);
  batch.set(doc(db, "labBookings", bookingId(booking.labKode, booking.tanggal, booking.slot)), {
    ...booking,
    sessionId: ref.id,
  });
  try {
    await tungguTulis(batch.commit());
  } catch (e) {
    pesanSimpanJadwal(e);
  }
  return ref.id;
}

/** Ubah jadwal sesi (tanggal, lab, jam). Kelas sesi tidak bisa diganti. Hanya saat Belum Dibuka. */
export async function updateSession(
  sessionId: string,
  asistenId: string,
  input: SessionInput
): Promise<void> {
  const data = validasiSesi(input);
  const { ref, sesi } = await getEditableSession(sessionId, asistenId);
  if (data.kelasId !== sesi.kelasId) throw new Error("Kelas sesi tidak bisa diganti. Buat sesi baru.");
  tolakJadwalLewat(data.tanggal, data.slot);
  const { jadwal, booking } = await siapkanJadwal(asistenId, data, sessionId);

  const idLama = sesi.labKode && sesi.slot ? bookingId(sesi.labKode, sesi.tanggal, sesi.slot) : null;
  const idBaru = bookingId(booking.labKode, booking.tanggal, booking.slot);
  const batch = writeBatch(db);
  batch.update(ref, jadwal);
  if (idLama !== idBaru) {
    batch.set(doc(db, "labBookings", idBaru), { ...booking, sessionId });
    if (idLama) batch.delete(doc(db, "labBookings", idLama));
  }
  try {
    await tungguTulis(batch.commit());
  } catch (e) {
    pesanSimpanJadwal(e);
  }

  // SRS-35: Kirim notifikasi ke praktikan kelas saat jadwal sesi diubah.
  // Gagal kirim notif tidak boleh mengganggu alur ubah jadwal (dikirim di latar, tidak ditunggu).
  kirimDiLatar("updateSession", async () => {
    const kelasSnap = await getDoc(doc(db, "classes", sesi.kelasId));
    const pesertaIds = (kelasSnap.data()?.pesertaIds ?? []) as string[];
    if (pesertaIds.length > 0) {
      await kirimNotifikasi(
        pesertaIds,
        "Jadwal Sesi Diubah 📅",
        `Jadwal sesi ${sesi.praktikum} telah diperbarui. Cek jadwal terbaru kamu.`,
        { layar: "jadwal", id: sessionId, penting: true },
      );
    }
  });
}

/** Hapus sesi beserta booking lab-nya. Ditolak jika sudah dibuka atau sudah ada pengajuan izin. */
export async function deleteSession(sessionId: string, asistenId: string): Promise<void> {
  const { ref, sesi } = await getEditableSession(sessionId, asistenId);
  const izin = await getDocs(
    query(
      collection(db, "leaveRequests"),
      where("kelasId", "==", sesi.kelasId),
      where("sessionId", "==", sessionId),
      limit(1)
    )
  );
  if (!izin.empty) {
    throw new Error("Sesi ini sudah punya pengajuan izin, jadi tidak bisa dihapus.");
  }
  const batch = writeBatch(db);
  batch.delete(ref);
  if (sesi.labKode && sesi.slot) batch.delete(doc(db, "labBookings", bookingId(sesi.labKode, sesi.tanggal, sesi.slot)));
  await tungguTulis(batch.commit());
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