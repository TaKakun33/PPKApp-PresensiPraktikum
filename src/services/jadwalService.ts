// Service jadwal: data lab, slot waktu 2 jam, booking lab, dan pemeriksaan bentrok jadwal.
// Dipisah dari sessionService/classService supaya keduanya bisa memakainya tanpa impor melingkar.
// Koleksi:
//   labs        : labs/{kode} = { kode, nama, kapasitas } — diisi admin lewat Firebase Console.
//   labBookings : labBookings/{labKode}_{tanggal}_{slot} = { sessionId, kelasId, labKode, tanggal, slot }
//                 ID deterministik = satu lab hanya bisa dipakai satu sesi pada slot yang sama
//                 (dokumen yang sudah ada tidak bisa dibuat lagi; ditegakkan firestore.rules).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type FirestoreError,
} from '@react-native-firebase/firestore';

import { SLOT_WAKTU, type SlotWaktu } from '../lib/constants';
import { db } from '../lib/firebase';
import type { Lab } from '../lib/types';

export type LabBooking = {
  id: string;
  sessionId: string;
  kelasId: string;
  labKode: string;
  tanggal: string;
  slot: number;
};

// ─── Lab ──────────────────────────────────────────────────────────────────────

function urutLab(a: Lab, b: Lab): number {
  // A, B, C, D lalu AP (kode lebih pendek dulu, lalu abjad).
  return a.kode.length - b.kode.length || a.kode.localeCompare(b.kode);
}

/** Real-time daftar lab (dropdown Ruangan Lab). */
export function subscribeLabs(
  onData: (labs: Lab[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'labs'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const data = (d.data() ?? {}) as Partial<Lab>;
            return {
              kode: d.id,
              nama: data.nama ?? `Lab ${d.id}`,
              kapasitas: Number(data.kapasitas ?? 0),
            };
          })
          .sort(urutLab),
      ),
    (err: FirestoreError) => onError?.(err),
  );
}

/** Ambil satu lab. null jika kode lab tidak ada di koleksi labs. */
export async function getLab(kode: string): Promise<Lab | null> {
  const snap = await getDoc(doc(db, 'labs', kode));
  if (!snap.exists()) return null;
  const data = (snap.data() ?? {}) as Partial<Lab>;
  return { kode, nama: data.nama ?? `Lab ${kode}`, kapasitas: Number(data.kapasitas ?? 0) };
}

// ─── Slot waktu ───────────────────────────────────────────────────────────────

export function getSlot(nomor: number | undefined): SlotWaktu | undefined {
  return SLOT_WAKTU.find((s) => s.slot === nomor);
}

/** Nomor slot dari jam mulai, untuk sesi lama yang belum menyimpan `slot`. */
export function slotDariJam(waktuMulai: string, waktuSelesai: string): number | undefined {
  return SLOT_WAKTU.find((s) => s.mulai === waktuMulai && s.selesai === waktuSelesai)?.slot;
}

/** Waktu (epoch ms) dari tanggal "TTTT-BB-HH" + jam "JJ:MM" WIB, apa pun zona waktu perangkat. */
export function waktuWib(tanggal: string, jam: string): number {
  const [y, m, d] = tanggal.split('-').map(Number);
  const [h, mnt] = jam.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h - 7, mnt);
}

/** Tanggal hari ini menurut WIB, format "TTTT-BB-HH". */
export function hariIniWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Slot ini sudah lewat (jam selesainya terlewati) pada tanggal tersebut. */
export function slotSudahLewat(tanggal: string, slot: SlotWaktu): boolean {
  return Date.now() >= waktuWib(tanggal, slot.selesai);
}

// ─── Booking lab ──────────────────────────────────────────────────────────────

export function bookingId(labKode: string, tanggal: string, slot: number): string {
  return `${labKode}_${tanggal}_${slot}`;
}

function mapBooking(d: { id: string; data: () => unknown }): LabBooking {
  return { id: d.id, ...((d.data() ?? {}) as Omit<LabBooking, 'id'>) };
}

/** Booking satu lab pada satu tanggal (untuk menonaktifkan slot yang sudah terpakai). */
export function subscribeBookingLab(
  labKode: string,
  tanggal: string,
  onData: (bookings: LabBooking[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'labBookings'), where('labKode', '==', labKode), where('tanggal', '==', tanggal)),
    (snap) => onData(snap.docs.map(mapBooking)),
    (err: FirestoreError) => onError?.(err),
  );
}

async function bookingPadaSlot(tanggal: string, slot: number): Promise<LabBooking[]> {
  const snap = await getDocs(
    query(collection(db, 'labBookings'), where('tanggal', '==', tanggal), where('slot', '==', slot)),
  );
  return snap.docs.map(mapBooking);
}

async function bookingKelas(kelasIds: string[]): Promise<LabBooking[]> {
  const hasil: LabBooking[] = [];
  for (let i = 0; i < kelasIds.length; i += 30) {
    const snap = await getDocs(
      query(collection(db, 'labBookings'), where('kelasId', 'in', kelasIds.slice(i, i + 30))),
    );
    hasil.push(...snap.docs.map(mapBooking));
  }
  return hasil;
}

type InfoKelas = { id: string; namaKelas: string; praktikum: string; pesertaIds: string[] };

async function getInfoKelas(kelasId: string): Promise<InfoKelas | null> {
  const snap = await getDoc(doc(db, 'classes', kelasId));
  if (!snap.exists()) return null;
  const d = (snap.data() ?? {}) as Partial<InfoKelas>;
  return {
    id: kelasId,
    namaKelas: d.namaKelas ?? '',
    praktikum: d.praktikum ?? '',
    pesertaIds: Array.isArray(d.pesertaIds) ? d.pesertaIds : [],
  };
}

function labelKelas(k: InfoKelas): string {
  return `Kelas ${k.namaKelas}${k.praktikum ? ` (${k.praktikum})` : ''}`;
}

/**
 * Tolak jadwal sesi yang bentrok (evaluasi Sprint 2 poin 6, 7, 14). Melempar Error berisi pesan siap tampil.
 * - Lab sudah dipakai sesi lain pada slot itu (juga ditegakkan server lewat ID booking).
 * - Kelas yang sama sudah punya sesi lain pada slot itu.
 * - Ada peserta kelas ini yang juga peserta kelas lain yang punya sesi pada slot itu.
 */
export async function cekBentrokSesi(params: {
  kelasId: string;
  pesertaIds: string[];
  labKode: string;
  tanggal: string;
  slot: number;
  kecualiSessionId?: string;
}): Promise<void> {
  const { kelasId, pesertaIds, labKode, tanggal, slot, kecualiSessionId } = params;
  const lain = (await bookingPadaSlot(tanggal, slot)).filter((b) => b.sessionId !== kecualiSessionId);

  if (lain.some((b) => b.labKode === labKode)) {
    throw new Error(`Lab ${labKode} sudah dibooking sesi lain pada jam tersebut. Pilih jam atau lab lain.`);
  }
  if (lain.some((b) => b.kelasId === kelasId)) {
    throw new Error('Kelas ini sudah punya sesi lain pada jam tersebut.');
  }

  const peserta = new Set(pesertaIds);
  if (peserta.size === 0) return;
  for (const kelasLainId of new Set(lain.map((b) => b.kelasId))) {
    const kelasLain = await getInfoKelas(kelasLainId);
    if (!kelasLain) continue;
    const bentrok = kelasLain.pesertaIds.filter((uid) => peserta.has(uid)).length;
    if (bentrok > 0) {
      throw new Error(
        `${bentrok} praktikan kelas ini juga mengikuti ${labelKelas(kelasLain)} yang punya sesi pada jam tersebut.`,
      );
    }
  }
}

/**
 * Tolak penambahan praktikan ke kelas jika jadwal kelas ini bentrok dengan jadwal kelas lain
 * yang sudah diikutinya (hanya sesi hari ini dan seterusnya).
 */
export async function cekBentrokPeserta(kelasId: string, kelasLainIds: string[]): Promise<void> {
  const lainIds = kelasLainIds.filter((id) => id !== kelasId);
  if (lainIds.length === 0) return;

  const hariIni = hariIniWib();
  const kunci = (b: LabBooking) => `${b.tanggal}_${b.slot}`;
  const milikKelas = new Set((await bookingKelas([kelasId])).filter((b) => b.tanggal >= hariIni).map(kunci));
  if (milikKelas.size === 0) return;

  const bentrok = (await bookingKelas(lainIds)).find((b) => b.tanggal >= hariIni && milikKelas.has(kunci(b)));
  if (!bentrok) return;

  const kelasLain = await getInfoKelas(bentrok.kelasId);
  const slot = getSlot(bentrok.slot);
  throw new Error(
    `Jadwal bentrok: praktikan ini mengikuti ${kelasLain ? labelKelas(kelasLain) : 'kelas lain'} pada ` +
      `${bentrok.tanggal}${slot ? ` ${slot.mulai}–${slot.selesai}` : ''}, sama dengan sesi kelas ini.`,
  );
}
