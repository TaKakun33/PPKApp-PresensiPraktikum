// FILE AKMAL (feat/auth-leave-ai) — SRS-13 & SRS-14.
// Akses data pengajuan izin untuk sisi praktikan: kirim, pantau, dan daftar sesi yang bisa diajukan.
// (Sisi asisten — memeriksa & memutuskan — ada di leaveReviewService milik Naufal.)
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type FirestoreError,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import { STATUS_IZIN, STATUS_SESI } from '../lib/constants';
import { db } from '../lib/firebase';
import type { LeaveRequest, Profile, Session } from '../lib/types';
import { classifyLeaveReason } from './aiService';
import { createAppError, getErrorCode, isTimeoutError, withTimeout } from './serviceUtils';
import { subscribeSessions } from './sessionService';

// createdAt ditambahkan Akmal (belum ada di tipe PM) supaya daftar bisa diurutkan.
// pending: true selama tulisan masih antre di perangkat (belum dikonfirmasi server).
export type LeaveItem = LeaveRequest & { createdAt?: unknown; pending?: boolean };

/**
 * ID dokumen pengajuan = `{sessionId}_{uid}`. Dengan ID deterministik, Firestore Security Rules
 * bisa menjamin SATU pengajuan per praktikan per sesi (pengajuan ganda dari dua perangkat / saat
 * offline tidak mungkin lolos). Pola ini HARUS sama dengan yang dicek di firestore.rules.
 */
export function leaveDocId(sessionId: string, userId: string): string {
  return `${sessionId}_${userId}`;
}

export const LEAVE_REASON_MIN = 10;
export const LEAVE_REASON_MAX = 300;

const WRITE_TIMEOUT_MS = 12000;

/** Validasi alasan. Mengembalikan pesan error, atau null jika valid. */
export function validateLeaveReason(alasan: string): string | null {
  const text = alasan.trim();
  if (!text) return 'Alasan izin harus diisi.';
  if (text.length < LEAVE_REASON_MIN) return `Alasan minimal ${LEAVE_REASON_MIN} karakter agar jelas.`;
  if (text.length > LEAVE_REASON_MAX) return `Alasan maksimal ${LEAVE_REASON_MAX} karakter.`;
  return null;
}

/** Izin yang masih "hidup" untuk sebuah sesi: menunggu atau sudah diterima. Yang ditolak boleh diajukan ulang
 *  (menimpa dokumen yang sama; Rules hanya mengizinkannya jika status sebelumnya ditolak). */
export function isActiveLeave(item: Pick<LeaveRequest, 'status'>): boolean {
  return item.status === STATUS_IZIN.MENUNGGU || item.status === STATUS_IZIN.DITERIMA;
}

// createdAt bisa null sesaat (serverTimestamp belum terisi) → anggap paling baru.
function createdMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as { toMillis: unknown }).toMillis;
    if (typeof fn === 'function') return (fn as () => number).call(value);
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Real-time: pengajuan izin milik satu praktikan, terbaru di atas. */
export function subscribeMyLeaves(
  userId: string,
  onData: (items: LeaveItem[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  const q = query(collection(db, 'leaveRequests'), where('userId', '==', userId));
  // includeMetadataChanges: supaya penanda `pending` ikut berubah saat server sudah mengonfirmasi tulisan.
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) => {
      const items = snap.docs.map(
        (d) => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }) as LeaveItem,
      );
      items.sort((a, b) => createdMs(b.createdAt) - createdMs(a.createdAt));
      onData(items);
    },
    (err: FirestoreError) => onError?.(err),
  );
}

/**
 * Real-time: sesi yang boleh diajukan izin (belum ditutup) untuk praktikan.
 * Memakai subscribeSessions dari sessionService (milik Hadrian) — satu-satunya titik ketergantungan.
 */
export function subscribeLeaveSessionOptions(
  profile: Profile,
  onData: (sessions: Session[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  return subscribeSessions(
    profile,
    (sessions) => {
      const open = sessions
        .filter((s) => s.status !== STATUS_SESI.DITUTUP)
        .sort((a, b) => `${a.tanggal} ${a.waktuMulai}`.localeCompare(`${b.tanggal} ${b.waktuMulai}`));
      onData(open);
    },
    onError,
  );
}

export type LeaveWriteOutcome = { ok: true } | { ok: false; error: unknown };

export type SubmitLeaveResult = {
  id: string;
  kategoriAI: string | null;
  aiStatus: 'berhasil' | 'gagal';
  /** true jika koneksi lambat/offline: pengajuan antre di perangkat dan terkirim otomatis saat online. */
  queued: boolean;
  /**
   * Hasil akhir penulisan ke server. Untuk pengajuan yang tidak antre, sudah selesai (ok: true).
   * Untuk yang antre, baru selesai saat server menjawab — bisa saja DITOLAK Rules (mis. sesi keburu
   * ditutup), jadi layar harus menampilkan hasilnya, bukan menganggap pasti terkirim.
   */
  settled: Promise<LeaveWriteOutcome>;
};

/**
 * Ajukan izin. Urutan: validasi → klasifikasi AI → simpan ke Firestore (status "menunggu").
 * - AI gagal  → izin tetap tersimpan tanpa kategori.
 * - AI TIDAK menentukan status; status selalu "menunggu".
 * - AI dipanggil sebelum simpan karena aturan Firestore melarang praktikan mengubah isi pengajuan
 *   yang sedang menunggu.
 * - ID dokumen deterministik (lihat leaveDocId): keunikan per sesi ditegakkan oleh server.
 */
export async function submitLeave(
  profile: Profile,
  session: Session,
  alasan: string,
): Promise<SubmitLeaveResult> {
  if (profile.role !== 'praktikan') {
    throw createAppError('app/not-allowed', 'Hanya praktikan yang dapat mengajukan izin.');
  }
  const reasonError = validateLeaveReason(alasan);
  if (reasonError) throw createAppError('app/invalid-input', reasonError);
  if (session.status === STATUS_SESI.DITUTUP) {
    throw createAppError('app/session-closed', 'Sesi sudah ditutup, izin tidak dapat diajukan.');
  }

  const text = alasan.trim();
  const ref = doc(db, 'leaveRequests', leaveDocId(session.id, profile.id));

  // Pemeriksaan ramah sebelum menulis. Penegakan sebenarnya ada di firestore.rules,
  // jadi jika pengecekan ini gagal (mis. offline tanpa cache) kita lanjut saja.
  try {
    const existing = await withTimeout(getDoc(ref), 5000);
    if (existing.exists()) {
      const data = existing.data() as Partial<LeaveRequest> | undefined;
      if (data?.status !== undefined && isActiveLeave({ status: data.status })) {
        throw createAppError('app/duplicate-leave', 'Kamu sudah mengajukan izin untuk sesi ini.');
      }
    }
  } catch (e) {
    if (getErrorCode(e) === 'app/duplicate-leave') throw e;
  }

  const ai = await classifyLeaveReason(text);

  const leave = {
    sessionId: session.id,
    kelasId: session.kelasId,
    asistenId: session.asistenId,
    praktikum: session.praktikum,
    userId: profile.id,
    nama: profile.nama,
    nim: profile.nim ?? '',
    alasan: text,
    kategoriAI: ai.kategori,
    aiStatus: ai.status,
    status: STATUS_IZIN.MENUNGGU,
    createdAt: serverTimestamp(),
  };

  const write = setDoc(ref, leave);
  const settled: Promise<LeaveWriteOutcome> = write.then(
    () => ({ ok: true }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  );
  const base = { id: ref.id, kategoriAI: ai.kategori, aiStatus: ai.status, settled };

  try {
    await withTimeout(write, WRITE_TIMEOUT_MS);
    return { ...base, queued: false };
  } catch (e) {
    // Offline / lambat: Firestore menyimpan antrean lokal dan mengirimnya saat online.
    if (isTimeoutError(e)) return { ...base, queued: true };
    if (getErrorCode(e) === 'firestore/permission-denied') {
      throw createAppError(
        'app/leave-rejected',
        'Pengajuan ditolak server. Mungkin kamu sudah mengajukan izin untuk sesi ini, atau sesinya sudah ditutup.',
      );
    }
    throw e;
  }
}

/**
 * Batalkan pengajuan yang masih "menunggu" (praktikan pemilik). Setelah dibatalkan, praktikan bisa
 * mengajukan ulang dengan alasan yang diperbaiki. Pengajuan yang sudah diputuskan asisten tidak bisa dibatalkan.
 * @returns true jika perintah masih antre di perangkat (offline).
 */
export async function cancelLeave(profile: Profile, leave: Pick<LeaveRequest, 'id' | 'status' | 'userId'>): Promise<boolean> {
  if (profile.role !== 'praktikan' || leave.userId !== profile.id) {
    throw createAppError('app/not-allowed', 'Kamu hanya dapat membatalkan pengajuan milikmu sendiri.');
  }
  if (leave.status !== STATUS_IZIN.MENUNGGU) {
    throw createAppError('app/not-allowed', 'Pengajuan yang sudah diputuskan asisten tidak dapat dibatalkan.');
  }
  try {
    await withTimeout(deleteDoc(doc(db, 'leaveRequests', leave.id)), WRITE_TIMEOUT_MS);
    return false;
  } catch (e) {
    if (isTimeoutError(e)) return true;
    if (getErrorCode(e) === 'firestore/permission-denied') {
      throw createAppError(
        'app/leave-rejected',
        'Pengajuan tidak dapat dibatalkan — mungkin asisten baru saja memutuskannya.',
      );
    }
    throw e;
  }
}
