// Pemilik: Hadrian (feat/classsessioncrud), SRS-15.
// Service Firestore untuk kelas dan peserta kelas. Layar tidak memanggil Firestore langsung.
// Koleksi:
//   classes : { namaKelas, praktikum, asistenId, pesertaIds[] }
//   users   : profil; field kelasIds[] milik praktikan ikut diperbarui agar jadwalnya muncul.
// Semua fungsi subscribe mengembalikan fungsi unsubscribe (panggil di cleanup useEffect).
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type FirestoreError,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';

import { db } from '../lib/firebase';
import type { ClassDoc, Profile } from '../lib/types';
import { createAppError, getErrorCode, isTimeoutError, withTimeout } from './serviceUtils';

export type ClassInput = { namaKelas: string; praktikum: string };

// Batas panjang isian (karakter).
export const MAKS_NAMA_KELAS = 50;
export const MAKS_PRAKTIKUM = 100;

// Saat offline, tulisan Firestore tidak gagal: disimpan di perangkat dan promise-nya menggantung
// sampai koneksi kembali. Setelah batas ini, layar diberi tahu bahwa perubahan masih tertunda.
const BATAS_TULIS_MS = 12000;
const KODE_TERTUNDA = 'app/tertunda';

/**
 * Tunggu tulisan Firestore. Jika server belum mengonfirmasi dalam batas waktu (biasanya offline),
 * lempar error `app/tertunda`. Perubahan TETAP tersimpan di perangkat dan dikirim otomatis nanti,
 * jadi layar sebaiknya memperlakukannya sebagai berhasil (tutup form) agar tidak tersimpan dua kali.
 */
export async function tungguTulis(tulis: Promise<unknown>): Promise<void> {
  try {
    await withTimeout(tulis, BATAS_TULIS_MS);
  } catch (e) {
    if (isTimeoutError(e)) {
      throw createAppError(
        KODE_TERTUNDA,
        'Koneksi bermasalah. Perubahan disimpan di perangkat dan akan dikirim otomatis saat koneksi kembali.',
      );
    }
    throw e;
  }
}

/** Tulisan belum terkirim ke server tetapi sudah tersimpan di perangkat. */
export function isTertunda(e: unknown): boolean {
  return getErrorCode(e) === KODE_TERTUNDA;
}

/** Ubah error Firestore menjadi pesan yang ramah untuk pengguna. */
export function pesanFirestore(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  // Error buatan aplikasi (app/...) sudah membawa pesan siap tampil.
  if (code.startsWith('app/') && e instanceof Error && e.message) return e.message;
  if (code.includes('permission-denied')) return 'Kamu tidak punya akses ke data ini.';
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.';
  }
  if (code.includes('not-found')) return 'Data tidak ditemukan atau sudah dihapus.';
  // Error tanpa kode berasal dari validasi service ini, pesannya sudah ramah.
  if (!code && e instanceof Error && e.message) return e.message;
  return fallback;
}

function mapClass(snap: QueryDocumentSnapshot | DocumentSnapshot): ClassDoc {
  const d = (snap.data() ?? {}) as Partial<ClassDoc>;
  return {
    id: snap.id,
    namaKelas: d.namaKelas ?? '',
    praktikum: d.praktikum ?? '',
    asistenId: d.asistenId ?? '',
    pesertaIds: Array.isArray(d.pesertaIds) ? d.pesertaIds : [],
  };
}

function mapProfile(snap: QueryDocumentSnapshot | DocumentSnapshot): Profile {
  return { id: snap.id, ...(snap.data() ?? {}) } as Profile;
}

function bersihkan(input: ClassInput): ClassInput {
  const namaKelas = input.namaKelas.trim();
  const praktikum = input.praktikum.trim();
  if (!namaKelas) throw new Error('Nama kelas harus diisi.');
  if (!praktikum) throw new Error('Nama praktikum harus diisi.');
  if (namaKelas.length > MAKS_NAMA_KELAS) {
    throw new Error(`Nama kelas maksimal ${MAKS_NAMA_KELAS} karakter.`);
  }
  if (praktikum.length > MAKS_PRAKTIKUM) {
    throw new Error(`Nama praktikum maksimal ${MAKS_PRAKTIKUM} karakter.`);
  }
  return { namaKelas, praktikum };
}

// Listener banyak dokumen berdasarkan daftar id. Tiap dokumen didengarkan lewat listener `get`
// (bukan query `documentId() in [...]`), karena firestore.rules hanya mengizinkan `list` pada `users`
// dengan filter role + limit kecil (lihat catatan di rules). Hasil digabung setelah semua dokumen terbaca.
function subscribeByIds<T>(
  collectionName: string,
  ids: string[],
  map: (snap: DocumentSnapshot) => T,
  onData: (items: T[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const unik = [...new Set(ids)];
  if (unik.length === 0) {
    onData([]);
    return () => {};
  }

  const hasil = new Map<string, T | null>();
  const unsubs = unik.map((id) =>
    onSnapshot(
      doc(db, collectionName, id),
      (snap: DocumentSnapshot) => {
        hasil.set(id, snap.exists() ? map(snap) : null);
        if (hasil.size === unik.length) onData([...hasil.values()].filter((x): x is T => x !== null));
      },
      (err: FirestoreError) => onError?.(err),
    ),
  );
  return () => unsubs.forEach((u) => u());
}

// ─── KELAS ────────────────────────────────────────────────────────────────────

/** Real-time listener kelas yang diampu asisten. */
export function subscribeClassesForAsisten(
  asistenId: string,
  onData: (classes: ClassDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'classes'), where('asistenId', '==', asistenId)),
    (snap) => onData(snap.docs.map(mapClass)),
    (err: FirestoreError) => onError?.(err),
  );
}

/** Real-time listener kelas berdasarkan daftar id (untuk praktikan: profile.kelasIds). */
export function subscribeClassesByIds(
  ids: string[],
  onData: (classes: ClassDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  // Praktikan hanya boleh `get` dokumen kelas miliknya (firestore.rules), bukan `list`.
  // Jadi tiap kelas didengarkan lewat listener dokumen, bukan query `documentId() in [...]`.
  const unik = [...new Set(ids)];
  if (unik.length === 0) {
    onData([]);
    return () => {};
  }

  const hasil = new Map<string, ClassDoc | null>();
  const unsubs = unik.map((id) =>
    onSnapshot(
      doc(db, 'classes', id),
      (snap) => {
        hasil.set(id, snap.exists() ? mapClass(snap) : null);
        if (hasil.size === unik.length) {
          onData([...hasil.values()].filter((c): c is ClassDoc => c !== null));
        }
      },
      (err: FirestoreError) => onError?.(err),
    ),
  );
  return () => unsubs.forEach((u) => u());
}

/** Real-time listener kelas milik pengguna sesuai perannya. */
export function subscribeClassesForUser(
  profile: Profile,
  onData: (classes: ClassDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return profile.role === 'asisten'
    ? subscribeClassesForAsisten(profile.id, onData, onError)
    : subscribeClassesByIds(profile.kelasIds ?? [], onData, onError);
}

/** Real-time listener satu kelas. Mengirim null jika kelas tidak ada. */
export function subscribeClass(
  classId: string,
  onData: (cls: ClassDoc | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'classes', classId),
    (snap) => onData(snap.exists() ? mapClass(snap) : null),
    (err: FirestoreError) => onError?.(err),
  );
}

/** Tambah kelas baru yang diampu asisten. */
export async function createClass(asistenId: string, input: ClassInput): Promise<string> {
  const data = bersihkan(input);
  const ref = doc(collection(db, 'classes'));
  const kelas: Omit<ClassDoc, 'id'> = { ...data, asistenId, pesertaIds: [] };
  await tungguTulis(setDoc(ref, kelas));
  return ref.id;
}

/** Ubah nama kelas dan praktikum. */
export async function updateClass(classId: string, input: ClassInput): Promise<void> {
  await tungguTulis(updateDoc(doc(db, 'classes', classId), bersihkan(input)));
}

/**
 * Hapus kelas. Ditolak jika kelas masih punya sesi.
 * kelasIds setiap peserta ikut dibersihkan supaya profilnya tidak menunjuk kelas yang hilang.
 */
export async function deleteClass(cls: ClassDoc): Promise<void> {
  const sesi = await getDocs(
    query(
      collection(db, 'sessions'),
      where('asistenId', '==', cls.asistenId),
      where('kelasId', '==', cls.id),
      limit(1),
    ),
  );
  if (!sesi.empty) {
    throw new Error('Kelas ini masih punya sesi. Hapus sesinya terlebih dahulu.');
  }

  const batch = writeBatch(db);
  cls.pesertaIds.forEach((uid) =>
    batch.update(doc(db, 'users', uid), { kelasIds: arrayRemove(cls.id) }),
  );
  batch.delete(doc(db, 'classes', cls.id));
  await tungguTulis(batch.commit());
}

// ─── PESERTA ──────────────────────────────────────────────────────────────────

/** Real-time listener profil peserta kelas. */
export function subscribePeserta(
  pesertaIds: string[],
  onData: (peserta: Profile[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return subscribeByIds('users', pesertaIds, mapProfile, onData, onError);
}

/** Cari praktikan berdasarkan NIM (string; jika kosong coba juga NIM bertipe angka dari data lama). */
async function cariPraktikanByNim(nim: string): Promise<Profile | undefined> {
  const kandidat: (string | number)[] = [nim];
  if (/^\d+$/.test(nim) && Number.isSafeInteger(Number(nim))) kandidat.push(Number(nim));
  for (const nilai of kandidat) {
    const snap = await getDocsFromServer(
      // Filter role + limit(5) wajib: firestore.rules hanya mengizinkan query users seperti ini.
      query(collection(db, 'users'), where('nim', '==', nilai), where('role', '==', 'praktikan'), limit(5)),
    );
    const hit = snap.docs.map(mapProfile).find((p) => p.role === 'praktikan');
    if (hit) return hit;
  }
  return undefined;
}

function kodeError(e: unknown): string {
  return String((e as { code?: unknown } | null)?.code ?? '');
}

/** Tambah praktikan ke kelas berdasarkan NIM. */
export async function addPesertaByNim(cls: ClassDoc, nim: string): Promise<Profile> {
  const nimBersih = nim.trim();
  if (!nimBersih) throw new Error('NIM harus diisi.');
  // Sama dengan aturan NIM saat registrasi (firestore.rules): 5-20 digit angka.
  if (!/^[0-9]{5,20}$/.test(nimBersih)) throw new Error('NIM harus berupa 5-20 digit angka.');

  // Langkah 1: cari praktikan. Error dibedakan dari langkah 2 supaya penyebab penolakan jelas.
  let praktikan: Profile | undefined;
  try {
    praktikan = await cariPraktikanByNim(nimBersih);
  } catch (e) {
    console.warn('[addPesertaByNim] cari NIM gagal:', kodeError(e), e);
    if (kodeError(e).includes('permission-denied')) {
      throw new Error(
        'Pencarian NIM ditolak server. Pastikan akunmu berperan asisten dan firestore.rules terbaru sudah di-deploy.',
      );
    }
    throw e;
  }
  if (!praktikan) throw new Error(`Praktikan dengan NIM ${nimBersih} tidak ditemukan.`);
  if (cls.pesertaIds.includes(praktikan.id)) {
    throw new Error(`${praktikan.nama} sudah terdaftar di kelas ini.`);
  }

  // Langkah 2: tulis kelas + profil praktikan dalam satu batch.
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayUnion(praktikan.id) });
    batch.update(doc(db, 'users', praktikan.id), { kelasIds: arrayUnion(cls.id) });
    await tungguTulis(batch.commit());
  } catch (e) {
    console.warn('[addPesertaByNim] simpan gagal:', kodeError(e), e);
    if (kodeError(e).includes('permission-denied')) {
      throw new Error(
        'Penyimpanan peserta ditolak server. Pastikan kelas ini dibuat oleh akunmu dan firestore.rules terbaru sudah di-deploy.',
      );
    }
    throw e;
  }
  return praktikan;
}

/** Keluarkan praktikan dari kelas. */
export async function removePeserta(cls: ClassDoc, userId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayRemove(userId) });
  batch.update(doc(db, 'users', userId), { kelasIds: arrayRemove(cls.id) });
  await tungguTulis(batch.commit());
}

/** Nama pengguna dari koleksi users. Mengembalikan null jika tidak bisa dibaca. */
export async function getNamaPengguna(userId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? ((snap.data()?.nama as string | undefined) ?? null) : null;
  } catch {
    return null;
  }
}
