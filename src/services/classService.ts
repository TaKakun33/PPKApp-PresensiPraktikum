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
  documentId,
  getDoc,
  getDocs,
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

export type ClassInput = { namaKelas: string; praktikum: string };

// Batas klausa `in` di Firestore.
const BATAS_IN = 30;

/** Ubah error Firestore menjadi pesan yang ramah untuk pengguna. */
export function pesanFirestore(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
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
  return { namaKelas, praktikum };
}

// Listener dokumen berdasarkan daftar id, dipecah per 30 karena batas klausa `in`.
function subscribeByIds<T>(
  collectionName: string,
  ids: string[],
  map: (snap: QueryDocumentSnapshot) => T,
  onData: (items: T[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const unik = [...new Set(ids)];
  if (unik.length === 0) {
    onData([]);
    return () => {};
  }

  const potongan: string[][] = [];
  for (let i = 0; i < unik.length; i += BATAS_IN) potongan.push(unik.slice(i, i + BATAS_IN));

  const hasil = new Map<number, T[]>();
  const unsubs = potongan.map((ids, i) =>
    onSnapshot(
      query(collection(db, collectionName), where(documentId(), 'in', ids)),
      (snap) => {
        hasil.set(i, snap.docs.map(map));
        if (hasil.size === potongan.length) onData([...hasil.values()].flat());
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
  return subscribeByIds('classes', ids, mapClass, onData, onError);
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
  await setDoc(ref, kelas);
  return ref.id;
}

/** Ubah nama kelas dan praktikum. */
export async function updateClass(classId: string, input: ClassInput): Promise<void> {
  await updateDoc(doc(db, 'classes', classId), bersihkan(input));
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
  await batch.commit();
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

/** Tambah praktikan ke kelas berdasarkan NIM. */
export async function addPesertaByNim(cls: ClassDoc, nim: string): Promise<Profile> {
  const nimBersih = nim.trim();
  if (!nimBersih) throw new Error('NIM harus diisi.');

  const snap = await getDocs(
    query(collection(db, 'users'), where('nim', '==', nimBersih), limit(5)),
  );
  const praktikan = snap.docs.map(mapProfile).find((p) => p.role === 'praktikan');
  if (!praktikan) throw new Error(`Praktikan dengan NIM ${nimBersih} tidak ditemukan.`);
  if (cls.pesertaIds.includes(praktikan.id)) {
    throw new Error(`${praktikan.nama} sudah terdaftar di kelas ini.`);
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayUnion(praktikan.id) });
  batch.update(doc(db, 'users', praktikan.id), { kelasIds: arrayUnion(cls.id) });
  await batch.commit();
  return praktikan;
}

/** Keluarkan praktikan dari kelas. */
export async function removePeserta(cls: ClassDoc, userId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayRemove(userId) });
  batch.update(doc(db, 'users', userId), { kelasIds: arrayRemove(cls.id) });
  await batch.commit();
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
