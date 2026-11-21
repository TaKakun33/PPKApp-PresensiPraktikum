// Pemilik: Hadrian (feat/classsessioncrud), SRS-15.
// Service Firestore untuk kelas dan peserta kelas. Layar tidak memanggil Firestore langsung.
// Koleksi:
//   classes/{praktikumId}_{kode} : { namaKelas (A–E), kode, praktikum, praktikumId, asistenId (pembuat),
//                                    asistenIds[] (maks. 2 pengampu), pesertaIds[] }
//   classes/{id}/peserta/{uid}  : { nama, nim, ditambahkanPada } — daftar nama praktikan per kelas
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
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type FirestoreError,
  type Query,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';

import { KODE_KELAS, MAKS_ASISTEN_KELAS, type KodeKelas } from '../lib/constants';
import { db } from '../lib/firebase';
import type { ClassDoc, Profile } from '../lib/types';
import { cekBentrokPeserta } from './jadwalService';
import { createAppError, getErrorCode, isTimeoutError, withTimeout } from './serviceUtils';

export type ClassInput = { praktikum: string; kode: KodeKelas };

// Batas panjang isian (karakter).
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

/** Pengampu kelas. Kelas lama (sebelum ada asistenIds) hanya punya asistenId pembuatnya. */
export function asistenIdsKelas(d: Partial<ClassDoc>): string[] {
  if (Array.isArray(d.asistenIds)) return d.asistenIds;
  return d.asistenId ? [d.asistenId] : [];
}

function mapClass(snap: QueryDocumentSnapshot | DocumentSnapshot): ClassDoc {
  const d = (snap.data() ?? {}) as Partial<ClassDoc>;
  return {
    id: snap.id,
    namaKelas: d.namaKelas ?? '',
    praktikum: d.praktikum ?? '',
    asistenId: d.asistenId ?? '',
    asistenIds: asistenIdsKelas(d),
    pesertaIds: Array.isArray(d.pesertaIds) ? d.pesertaIds : [],
    kode: d.kode,
    praktikumId: d.praktikumId,
  };
}

/** "Kelas A" untuk kelas baru; nama bebas untuk kelas lama. */
export function labelKelas(cls: Pick<ClassDoc, 'namaKelas'>): string {
  return (KODE_KELAS as readonly string[]).includes(cls.namaKelas) ? `Kelas ${cls.namaKelas}` : cls.namaKelas;
}

/** "Pemrograman Platform Khusus" -> "pemrograman-platform-khusus" (bagian ID dokumen kelas). */
export function slugPraktikum(praktikum: string): string {
  return praktikum
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    // Setelah dipotong pun tidak boleh diawali/diakhiri "-" (pola yang sama dicek firestore.rules).
    .replace(/^-+|-+$/g, '');
}

function mapProfile(snap: QueryDocumentSnapshot | DocumentSnapshot): Profile {
  return { id: snap.id, ...(snap.data() ?? {}) } as Profile;
}

function bersihkan(input: ClassInput): ClassInput & { praktikumId: string } {
  const praktikum = input.praktikum.trim().replace(/\s+/g, ' ');
  if (!praktikum) throw new Error('Nama praktikum harus diisi.');
  if (praktikum.length > MAKS_PRAKTIKUM) {
    throw new Error(`Nama praktikum maksimal ${MAKS_PRAKTIKUM} karakter.`);
  }
  if (!KODE_KELAS.includes(input.kode)) throw new Error('Pilih Kelas A, B, C, D, atau E.');
  const praktikumId = slugPraktikum(praktikum);
  if (!praktikumId) throw new Error('Nama praktikum harus memuat huruf atau angka.');
  return { praktikum, kode: input.kode, praktikumId };
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

/**
 * Real-time listener kelas yang diampu asisten (sebagai pembuat ATAU partner).
 * Dua query digabung: `asistenIds` (kelas baru) dan `asistenId` (kelas lama tanpa asistenIds).
 */
export function subscribeClassesForAsisten(
  asistenId: string,
  onData: (classes: ClassDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const hasil = new Map<string, ClassDoc[]>();
  const kirim = () => {
    if (hasil.size < 2) return;
    const unik = new Map<string, ClassDoc>();
    [...hasil.values()].flat().forEach((c) => unik.set(c.id, c));
    // Partner yang sudah keluar tidak lagi tercantum di asistenIds walau masih pembuat (asistenId).
    onData([...unik.values()].filter((c) => c.asistenIds.includes(asistenId)));
  };
  const dengar = (kunci: string, q: Query) =>
    onSnapshot(
      q,
      (snap) => {
        hasil.set(kunci, snap.docs.map(mapClass));
        kirim();
      },
      (err: FirestoreError) => onError?.(err),
    );
  const unsubs = [
    dengar('baru', query(collection(db, 'classes'), where('asistenIds', 'array-contains', asistenId))),
    dengar('lama', query(collection(db, 'classes'), where('asistenId', '==', asistenId))),
  ];
  return () => unsubs.forEach((u) => u());
}

/**
 * Listener gabungan per kelas yang diampu asisten: untuk setiap kelas dibuat satu listener dari
 * `buatListener(kelasId, kirim)`, lalu semua hasilnya digabung. Ikut berubah saat kelas bertambah
 * atau berkurang (mis. partner bergabung). Dipakai sessionService untuk sesi dan izin.
 */
export function subscribePerKelasAsisten<T>(
  asistenId: string,
  buatListener: (kelasId: string, kirim: (items: T[]) => void, gagal: (e: Error) => void) => () => void,
  onData: (items: T[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const listener = new Map<string, () => void>();
  const hasil = new Map<string, T[]>();
  const kirim = () => {
    if ([...listener.keys()].every((id) => hasil.has(id))) onData([...hasil.values()].flat());
  };

  const unsubKelas = subscribeClassesForAsisten(
    asistenId,
    (classes) => {
      const ids = new Set(classes.map((c) => c.id));
      for (const [id, unsub] of listener) {
        if (!ids.has(id)) {
          unsub();
          listener.delete(id);
          hasil.delete(id);
        }
      }
      for (const id of ids) {
        if (listener.has(id)) continue;
        listener.set(
          id,
          buatListener(
            id,
            (items) => {
              hasil.set(id, items);
              kirim();
            },
            (e) => onError?.(e),
          ),
        );
      }
      kirim();
    },
    onError,
  );

  return () => {
    unsubKelas();
    listener.forEach((u) => u());
  };
}

/** Daftar nama praktikum yang sudah ada (saran isian saat membuat / bergabung ke kelas). */
export async function getDaftarPraktikum(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'classes'));
  const nama = new Map<string, string>();
  snap.docs.forEach((d) => {
    const p = String(d.data()?.praktikum ?? '').trim();
    if (p) nama.set(slugPraktikum(p), p);
  });
  return [...nama.values()].sort((a, b) => a.localeCompare(b));
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

export type HasilSimpanKelas = { id: string; bergabung: boolean };

/**
 * Buat Kelas A–E untuk sebuah praktikum, atau BERGABUNG sebagai asisten partner jika kelas itu
 * sudah dibuat asisten lain. ID kelas = `{praktikumId}_{kode}`, jadi satu praktikum hanya punya
 * satu Kelas A, satu Kelas B, dst. Maksimal 2 asisten per kelas (juga ditegakkan firestore.rules).
 * Memakai transaksi supaya dua asisten yang bergabung bersamaan tidak membuat kelas berisi 3 asisten.
 */
export async function simpanKelas(asistenId: string, input: ClassInput): Promise<HasilSimpanKelas> {
  const { praktikum, kode, praktikumId } = bersihkan(input);
  const ref = doc(db, 'classes', `${praktikumId}_${kode}`);

  try {
    return await withTimeout(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          tx.set(ref, {
            namaKelas: kode,
            kode,
            praktikum,
            praktikumId,
            asistenId,
            asistenIds: [asistenId],
            pesertaIds: [],
          });
          return { id: ref.id, bergabung: false };
        }

        const ada = mapClass(snap);
        if (ada.asistenIds.includes(asistenId)) {
          throw new Error(`Kamu sudah mengampu Kelas ${kode} ${ada.praktikum}.`);
        }
        if (ada.asistenIds.length >= MAKS_ASISTEN_KELAS) {
          throw new Error(`Kelas ${kode} ${ada.praktikum} sudah punya ${MAKS_ASISTEN_KELAS} asisten.`);
        }
        tx.update(ref, { asistenIds: [...ada.asistenIds, asistenId] });
        return { id: ref.id, bergabung: true };
      }),
      BATAS_TULIS_MS,
    );
  } catch (e) {
    if (isTimeoutError(e)) {
      throw new Error('Tidak dapat terhubung ke server. Membuat atau bergabung ke kelas butuh koneksi internet.');
    }
    throw e;
  }
}

/** Asisten partner keluar dari kelas. Asisten terakhir tidak bisa keluar (hapus kelasnya saja). */
export async function keluarDariKelas(cls: ClassDoc, asistenId: string): Promise<void> {
  if (!cls.asistenIds.includes(asistenId)) throw new Error('Kamu bukan pengampu kelas ini.');
  if (cls.asistenIds.length < 2) {
    throw new Error('Kamu satu-satunya asisten kelas ini. Hapus kelasnya jika tidak dipakai lagi.');
  }
  await tungguTulis(
    updateDoc(doc(db, 'classes', cls.id), { asistenIds: cls.asistenIds.filter((id) => id !== asistenId) }),
  );
}

/**
 * Hapus kelas. Ditolak jika kelas masih punya sesi.
 * kelasIds setiap peserta ikut dibersihkan supaya profilnya tidak menunjuk kelas yang hilang.
 */
export async function deleteClass(cls: ClassDoc): Promise<void> {
  const sesi = await getDocs(query(collection(db, 'sessions'), where('kelasId', '==', cls.id), limit(1)));
  if (!sesi.empty) {
    throw new Error('Kelas ini masih punya sesi. Hapus sesinya terlebih dahulu.');
  }

  const batch = writeBatch(db);
  cls.pesertaIds.forEach((uid) => {
    batch.update(doc(db, 'users', uid), { kelasIds: arrayRemove(cls.id) });
    batch.delete(doc(db, 'classes', cls.id, 'peserta', uid));
  });
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

/** Cari praktikan berdasarkan NIM persis (string; jika kosong coba juga NIM bertipe angka dari data lama). */
async function cariPraktikanByNim(nim: string): Promise<Profile | undefined> {
  const kandidat: (string | number)[] = [nim];
  if (/^\d+$/.test(nim) && Number.isSafeInteger(Number(nim))) kandidat.push(Number(nim));
  for (const nilai of kandidat) {
    const snap = await getDocsFromServer(
      // Filter role + limit kecil wajib: firestore.rules hanya mengizinkan query users seperti ini.
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

const BATAS_HASIL_CARI = 10;

function huruBesarAwal(teks: string): string {
  return teks.replace(/\b\p{L}/gu, (h) => h.toUpperCase());
}

/**
 * Cari praktikan yang BELUM menjadi peserta kelas ini (evaluasi Sprint 2 poin 13).
 * - Angka  : awalan NIM, mis. "2223" menemukan semua NIM yang diawali 2223.
 * - Lainnya: awalan nama (dicoba seperti diketik dan dengan huruf besar di awal kata).
 * Butuh indeks komposit users (role, nim) dan (role, nama) — lihat firestore.indexes.json.
 */
export async function cariPraktikan(cls: ClassDoc, teks: string): Promise<Profile[]> {
  const cari = teks.trim();
  if (cari.length < 2) return [];

  const awalan = (field: 'nim' | 'nama', nilai: string) =>
    getDocsFromServer(
      query(
        collection(db, 'users'),
        where('role', '==', 'praktikan'),
        orderBy(field),
        where(field, '>=', nilai),
        where(field, '<=', `${nilai}\uf8ff`),
        limit(BATAS_HASIL_CARI),
      ),
    );

  const varian = /^\d+$/.test(cari)
    ? [{ field: 'nim' as const, nilai: cari }]
    : [...new Set([cari, huruBesarAwal(cari.toLowerCase())])].map((nilai) => ({ field: 'nama' as const, nilai }));

  const hasil = new Map<string, Profile>();
  try {
    for (const v of varian) {
      (await awalan(v.field, v.nilai)).docs.map(mapProfile).forEach((p) => hasil.set(p.id, p));
    }
  } catch (e) {
    console.warn('[cariPraktikan] gagal:', kodeError(e), e);
    if (kodeError(e).includes('failed-precondition')) {
      throw new Error('Indeks pencarian belum dibuat. Minta admin men-deploy firestore.indexes.json.');
    }
    throw e;
  }
  return [...hasil.values()]
    .filter((p) => p.role === 'praktikan' && !cls.pesertaIds.includes(p.id))
    .sort((a, b) => String(a.nim ?? '').localeCompare(String(b.nim ?? '')));
}

/**
 * Tambah praktikan ke kelas: pesertaIds kelas, kelasIds profil, dan dokumen nama di
 * classes/{id}/peserta/{uid} ditulis dalam satu batch. Ditolak jika jadwalnya bentrok.
 */
export async function addPeserta(cls: ClassDoc, praktikan: Profile): Promise<Profile> {
  if (cls.pesertaIds.includes(praktikan.id)) {
    throw new Error(`${praktikan.nama} sudah terdaftar di kelas ini.`);
  }
  await cekBentrokPeserta(cls.id, praktikan.kelasIds ?? []);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayUnion(praktikan.id) });
    batch.update(doc(db, 'users', praktikan.id), { kelasIds: arrayUnion(cls.id) });
    batch.set(doc(db, 'classes', cls.id, 'peserta', praktikan.id), {
      nama: praktikan.nama,
      nim: String(praktikan.nim ?? ''),
      ditambahkanPada: serverTimestamp(),
    });
    await tungguTulis(batch.commit());
  } catch (e) {
    console.warn('[addPeserta] simpan gagal:', kodeError(e), e);
    if (kodeError(e).includes('permission-denied')) {
      throw new Error(
        'Penyimpanan peserta ditolak server. Pastikan kamu pengampu kelas ini dan firestore.rules terbaru sudah di-deploy.',
      );
    }
    throw e;
  }
  return praktikan;
}

/** Tambah praktikan ke kelas berdasarkan NIM lengkap. */
export async function addPesertaByNim(cls: ClassDoc, nim: string): Promise<Profile> {
  const nimBersih = nim.trim();
  if (!nimBersih) throw new Error('NIM harus diisi.');
  // Sama dengan aturan NIM saat registrasi (firestore.rules): 5-20 digit angka.
  if (!/^[0-9]{5,20}$/.test(nimBersih)) throw new Error('NIM harus berupa 5-20 digit angka.');

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
  return addPeserta(cls, praktikan);
}

/** Keluarkan praktikan dari kelas. */
export async function removePeserta(cls: ClassDoc, userId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'classes', cls.id), { pesertaIds: arrayRemove(userId) });
  batch.update(doc(db, 'users', userId), { kelasIds: arrayRemove(cls.id) });
  batch.delete(doc(db, 'classes', cls.id, 'peserta', userId));
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
