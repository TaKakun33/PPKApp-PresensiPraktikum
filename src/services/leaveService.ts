// FILE AKMAL (feat/auth-leave-ai) — SRS-13 & SRS-14.
// Akses data pengajuan izin untuk sisi praktikan: kirim, pantau, dan daftar sesi yang bisa diajukan.
// (Sisi asisten — memeriksa & memutuskan — ada di leaveReviewService milik Naufal.)
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type FirestoreError,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';

import { STATUS_IZIN, STATUS_SESI } from '../app/constants';
import { db } from '../app/firebase';
import type { LeaveRequest, Profile, Session } from '../app/types';
import { classifyLeaveReason } from './aiService';
import { createAppError, isTimeoutError, withTimeout } from './serviceUtils';
import { subscribeSessions } from './sessionService';

// createdAt ditambahkan Akmal (belum ada di tipe PM) supaya daftar bisa diurutkan.
export type LeaveItem = LeaveRequest & { createdAt?: unknown };

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

/** Izin yang masih "hidup" untuk sebuah sesi: menunggu atau sudah diterima. Yang ditolak boleh diajukan ulang. */
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
  return onSnapshot(
    q,
    (snap: QuerySnapshot) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LeaveItem);
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

export type SubmitLeaveResult = {
  id: string;
  kategoriAI: string | null;
  aiStatus: 'berhasil' | 'gagal';
  /** true jika koneksi lambat/offline: pengajuan tersimpan di perangkat dan terkirim otomatis saat online. */
  queued: boolean;
};

/**
 * Ajukan izin. Urutan: validasi → klasifikasi AI → simpan ke Firestore (status "menunggu").
 * - AI gagal  → izin tetap tersimpan tanpa kategori.
 * - AI TIDAK menentukan status; status selalu "menunggu".
 * - AI dipanggil sebelum simpan karena aturan Firestore melarang praktikan mengubah pengajuan setelah dibuat.
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

  // Cegah pengajuan ganda untuk sesi yang sama (selama masih menunggu / sudah diterima).
  // Jika pengecekan gagal (misalnya offline tanpa cache), lanjutkan: layar sudah menyaring sesi tersebut.
  try {
    const existing = await getDocs(query(collection(db, 'leaveRequests'), where('userId', '==', profile.id)));
    const duplicate = existing.docs.some((d) => {
      const data = d.data() as Partial<LeaveRequest>;
      return data.sessionId === session.id && data.status !== undefined && isActiveLeave({ status: data.status });
    });
    if (duplicate) {
      throw createAppError('app/duplicate-leave', 'Kamu sudah mengajukan izin untuk sesi ini.');
    }
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === 'app/duplicate-leave') throw e;
  }

  const ai = await classifyLeaveReason(text);

  const ref = doc(collection(db, 'leaveRequests'));
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

  try {
    await withTimeout(setDoc(ref, leave), WRITE_TIMEOUT_MS);
    return { id: ref.id, kategoriAI: ai.kategori, aiStatus: ai.status, queued: false };
  } catch (e) {
    // Offline / lambat: Firestore menyimpan antrean lokal dan mengirimnya saat online.
    if (isTimeoutError(e)) {
      return { id: ref.id, kategoriAI: ai.kategori, aiStatus: ai.status, queued: true };
    }
    throw e;
  }
}
