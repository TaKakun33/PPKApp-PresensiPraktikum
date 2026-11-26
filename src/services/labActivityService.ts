// FILE AKMAL (feat/peta-lab) — SRS-31, SRS-32.
// Data untuk tab Peta, semuanya real-time dan hanya dibaca (tidak ada penulisan dari fitur ini):
//   labs     : labs/{kode} = { kode, nama, kapasitas, lat, lng, radiusMeter, ... } (ditulis asisten lewat
//              layar Kelola Lokasi Lab, milik Naufal). Lab yang belum punya koordinat tetap terbaca,
//              tetapi `koordinat` = null sehingga tidak digambar di peta.
//   sessions : jadwal sesi. Dibaca semua pengguna yang login (firestore.rules) untuk info aktivitas lab.
// Semua fungsi subscribe mengembalikan fungsi unsubscribe (panggil di cleanup effect).
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';

import { db } from '../lib/firebase';
import type { Session } from '../lib/types';
import { koordinatValid, type Koordinat } from '../utils/aktivitasLab';

export type LabPeta = {
  kode: string;
  nama: string;
  kapasitas: number;
  /** null jika lab belum punya koordinat yang valid. */
  koordinat: Koordinat | null;
  /** Radius presensi (meter); null jika belum diatur. */
  radiusMeter: number | null;
};

export type MetaData = {
  /** true = data berasal dari cache lokal (biasanya karena offline), belum tentu terbaru. */
  dariCache: boolean;
};

// ─── Lab ──────────────────────────────────────────────────────────────────────

/** Urutan lab: kode lebih pendek dulu, lalu abjad (B, C, D, lalu AP). Sama dengan jadwalService. */
function urutLab(a: LabPeta, b: LabPeta): number {
  return a.kode.length - b.kode.length || a.kode.localeCompare(b.kode);
}

function angkaAtauNull(nilai: unknown): number | null {
  return typeof nilai === 'number' && Number.isFinite(nilai) ? nilai : null;
}

function mapLab(d: QueryDocumentSnapshot): LabPeta {
  const data = (d.data() ?? {}) as DocumentData;
  const lat = data.lat;
  const lng = data.lng;
  return {
    kode: d.id,
    nama: typeof data.nama === 'string' && data.nama ? data.nama : `Lab ${d.id}`,
    kapasitas: Number(data.kapasitas ?? 0) || 0,
    koordinat: koordinatValid(lat, lng) ? { lat: lat as number, lng: lng as number } : null,
    radiusMeter: angkaAtauNull(data.radiusMeter),
  };
}

/** Real-time daftar lab beserta koordinatnya (marker peta). */
export function subscribeLabPeta(
  onData: (labs: LabPeta[], meta: MetaData) => void,
  onError?: (e: FirestoreError) => void,
): () => void {
  return onSnapshot(
    collection(db, 'labs'),
    { includeMetadataChanges: true },
    (snap) => onData(snap.docs.map(mapLab).sort(urutLab), { dariCache: snap.metadata.fromCache }),
    (err: FirestoreError) => onError?.(err),
  );
}

// ─── Sesi (aktivitas lab) ─────────────────────────────────────────────────────

function mapSesi(d: QueryDocumentSnapshot): Session | null {
  const data = (d.data() ?? {}) as Partial<Session>;
  // Dokumen sesi yang rusak/tidak lengkap dilewati supaya tidak merusak seluruh daftar.
  if (typeof data.tanggal !== 'string' || typeof data.waktuMulai !== 'string' || typeof data.waktuSelesai !== 'string') {
    return null;
  }
  return { ...(data as Omit<Session, 'id'>), id: d.id };
}

/**
 * Real-time sesi pada rentang tanggal [dariTanggal, sampaiTanggal] ("TTTT-BB-HH", WIB).
 * Query satu field (`tanggal`) sehingga tidak membutuhkan composite index. Pemilahan per lab dilakukan
 * di aplikasi (utils/aktivitasLab.hitungAktivitasLab) supaya satu listener cukup untuk semua lab.
 */
export function subscribeSesiRentang(
  dariTanggal: string,
  sampaiTanggal: string,
  onData: (sesi: Session[], meta: MetaData) => void,
  onError?: (e: FirestoreError) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'sessions'), where('tanggal', '>=', dariTanggal), where('tanggal', '<=', sampaiTanggal)),
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(mapSesi).filter((s): s is Session => s !== null),
        { dariCache: snap.metadata.fromCache },
      ),
    (err: FirestoreError) => onError?.(err),
  );
}
