// FILE AKMAL (feat/auth-leave-ai) — SRS-11 & SRS-12.
// Satu-satunya tempat yang bicara ke Firebase Auth dan dokumen profil `users/{uid}`.
// Registrasi terbuka untuk praktikan. Registrasi ASISTEN hanya berhasil jika email-nya sudah
// terdaftar di koleksi `allowedAssistants/{email huruf kecil}` (diisi admin lewat Firebase Console).
// Pemeriksaan yang sama dipasang di firestore.rules, jadi tidak bisa dilewati dari klien.
// Layar tidak boleh memanggil Firebase langsung; pakai AuthContext (yang memakai file ini).
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentSnapshot,
  type FirestoreError,
} from '@react-native-firebase/firestore';

import { auth, db } from '../lib/firebase';
import type { Role } from '../lib/constants';
import type { Profile } from '../lib/types';
import { createAppError, getErrorCode, getFriendlyError, withTimeout } from './serviceUtils';

// ─── validasi ─────────────────────────────────────────────────────────────────

export type RegisterInput = {
  role: Role;
  nama: string;
  email: string;
  password: string;
  confirmPassword: string;
  nim: string;
};

export type RegisterField = 'nama' | 'email' | 'password' | 'confirmPassword' | 'nim';
export type RegisterErrors = Partial<Record<RegisterField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8; // lebih ketat dari batas Firebase Auth (6)

export function validateRegisterInput(input: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {};
  const nama = input.nama.trim();
  const email = input.email.trim();
  const nim = input.nim.trim();

  if (nama.length < 3) errors.nama = 'Nama minimal 3 karakter.';
  else if (nama.length > 100) errors.nama = 'Nama maksimal 100 karakter.'; // selaras dengan firestore.rules
  if (!email) errors.email = 'Email harus diisi.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Format email tidak valid.';
  if (input.password.length < PASSWORD_MIN) {
    errors.password = `Password minimal ${PASSWORD_MIN} karakter.`;
  }
  if (!input.confirmPassword) errors.confirmPassword = 'Ulangi password kamu.';
  else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Konfirmasi password tidak sama.';
  }
  // NIM hanya untuk praktikan; asisten tidak mengisinya.
  if (input.role === 'praktikan') {
    if (!nim) errors.nim = 'NIM wajib diisi.';
    else if (!/^\d{5,20}$/.test(nim)) errors.nim = 'NIM hanya boleh angka (5–20 digit).';
  }
  return errors;
}

// ─── pesan error ──────────────────────────────────────────────────────────────

export function getAuthErrorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  switch (getErrorCode(e)) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau password salah.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi admin.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi nanti.';
    case 'auth/email-already-in-use':
      return 'Email sudah terdaftar. Gunakan email lain atau login.';
    case 'auth/weak-password':
      return `Password terlalu lemah. Minimal ${PASSWORD_MIN} karakter.`;
    case 'auth/operation-not-allowed':
      return 'Login email/password belum diaktifkan di Firebase. Hubungi PM.';
    default:
      return getFriendlyError(e, fallback);
  }
}

// ─── penanda "sedang registrasi" ──────────────────────────────────────────────
// Begitu akun Auth dibuat, onAuthStateChanged langsung aktif padahal dokumen profil belum
// sempat ditulis. AuthContext memakai penanda ini supaya tidak salah mengira profil hilang
// lalu mengeluarkan pengguna yang baru mendaftar.
let registering = false;
export function isRegistering(): boolean {
  return registering;
}

// ─── aksi ─────────────────────────────────────────────────────────────────────

const PROFILE_WRITE_TIMEOUT_MS = 15000;

export async function signInUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Lupa password: Firebase mengirim email berisi tautan untuk membuat password baru.
 * Pengaturan template email ada di Firebase Console > Authentication > Templates.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const clean = email.trim();
  if (!clean) throw createAppError('app/invalid-input', 'Email harus diisi.');
  if (!EMAIL_PATTERN.test(clean)) throw createAppError('auth/invalid-email', 'Format email tidak valid.');
  await withTimeout(sendPasswordResetEmail(auth, clean), PROFILE_WRITE_TIMEOUT_MS);
}

// ─── profil: ubah nama & password ─────────────────────────────────────────────

export const NAMA_MIN = 3;
export const NAMA_MAX = 100; // selaras dengan firestore.rules

/** Ubah nama pada dokumen profil sendiri. Field lain (email, NIM, peran) tidak bisa diubah dari sini. */
export async function updateProfileName(uid: string, nama: string): Promise<void> {
  const clean = nama.trim();
  if (clean.length < NAMA_MIN) throw createAppError('app/invalid-input', `Nama minimal ${NAMA_MIN} karakter.`);
  if (clean.length > NAMA_MAX) throw createAppError('app/invalid-input', `Nama maksimal ${NAMA_MAX} karakter.`);
  await withTimeout(updateDoc(doc(db, 'users', uid), { nama: clean }), PROFILE_WRITE_TIMEOUT_MS);
}

/** Ubah password. Firebase mewajibkan login ulang (password lama) sebelum password diganti. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw createAppError('app/not-signed-in', 'Sesi login berakhir. Silakan login kembali.');
  if (!currentPassword) throw createAppError('app/invalid-input', 'Password lama harus diisi.');
  if (newPassword.length < PASSWORD_MIN) {
    throw createAppError('app/invalid-input', `Password baru minimal ${PASSWORD_MIN} karakter.`);
  }
  if (newPassword === currentPassword) {
    throw createAppError('app/invalid-input', 'Password baru harus berbeda dari password lama.');
  }

  try {
    await withTimeout(
      reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword)),
      PROFILE_WRITE_TIMEOUT_MS,
    );
  } catch (e) {
    const code = getErrorCode(e);
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw createAppError('app/wrong-current-password', 'Password lama salah.');
    }
    throw e;
  }
  await withTimeout(updatePassword(user, newPassword), PROFILE_WRITE_TIMEOUT_MS);
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

const NIM_TAKEN_MESSAGE = 'NIM ini sudah terdaftar pada akun lain.';
const NOT_ALLOWED_ASSISTANT_MESSAGE =
  'Email ini tidak terdaftar sebagai asisten. Hubungi admin atau daftar sebagai praktikan.';

/**
 * Registrasi: buat akun Auth, lalu simpan profil ke `users/{uid}`.
 * - Praktikan: langsung boleh (profil berisi NIM dan kelasIds kosong).
 * - Asisten: email harus ada di `allowedAssistants/{email huruf kecil}`. Jika tidak, akun Auth dibatalkan.
 *   (Cek ini ditulis setelah akun dibuat karena aturan Firestore hanya mengizinkan pengguna yang sudah
 *   login membaca dokumen email-nya sendiri; daftar asisten tidak bisa dibaca publik.)
 * Jika langkah apa pun setelah akun Auth dibuat gagal, akun dihapus agar tidak ada akun yatim.
 */
export async function registerUser(input: RegisterInput): Promise<void> {
  const errors = validateRegisterInput(input);
  if (Object.keys(errors).length > 0) {
    throw createAppError('app/invalid-input', 'Data pendaftaran belum valid.');
  }

  const email = input.email.trim();
  const isAsisten = input.role === 'asisten';

  registering = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);

    // Batalkan akun supaya email yang sama bisa dipakai mendaftar lagi.
    const rollback = async () => {
      try {
        await deleteUser(cred.user);
      } catch {
        await fbSignOut(auth).catch(() => {});
      }
    };

    if (isAsisten) {
      let listed = false;
      try {
        const allowed = await withTimeout(
          getDoc(doc(db, 'allowedAssistants', email.toLowerCase())),
          PROFILE_WRITE_TIMEOUT_MS,
        );
        listed = allowed.exists();
      } catch (e) {
        await rollback();
        // permission-denied di sini berarti email tidak boleh membaca dokumen tsb → anggap tidak terdaftar.
        if (getErrorCode(e) === 'firestore/permission-denied') {
          throw createAppError('app/not-allowed-assistant', NOT_ALLOWED_ASSISTANT_MESSAGE);
        }
        throw createAppError(
          'app/profile-save-failed',
          getFriendlyError(e, 'Gagal memeriksa daftar asisten. Periksa koneksi internet lalu coba lagi.'),
        );
      }
      if (!listed) {
        await rollback();
        throw createAppError('app/not-allowed-assistant', NOT_ALLOWED_ASSISTANT_MESSAGE);
      }
    }

    const profile = isAsisten
      ? {
          nama: input.nama.trim(),
          email,
          role: 'asisten' as const,
          createdAt: serverTimestamp(),
        }
      : {
          nama: input.nama.trim(),
          email,
          role: 'praktikan' as const,
          nim: input.nim.trim(),
          kelasIds: [] as string[], // diisi asisten saat menambah peserta kelas
          createdAt: serverTimestamp(),
        };

    // NIM harus unik. Akun Auth sudah dibuat (jadi pengguna sudah login dan boleh query dengan limit 1),
    // jadi cek di sini; jika sudah dipakai, akun dibatalkan. Cek ini hanya di sisi aplikasi.
    if (!isAsisten) {
      try {
        const dup = await withTimeout(
          getDocs(query(collection(db, 'users'), where('nim', '==', input.nim.trim()), limit(1))),
          PROFILE_WRITE_TIMEOUT_MS,
        );
        if (!dup.empty) {
          await rollback();
          throw createAppError('app/nim-taken', NIM_TAKEN_MESSAGE);
        }
      } catch (e) {
        if (getErrorCode(e) === 'app/nim-taken') throw e;
        await rollback();
        throw createAppError(
          'app/profile-save-failed',
          getFriendlyError(e, 'Gagal memeriksa NIM. Periksa koneksi internet lalu coba lagi.'),
        );
      }
    }

    try {
      await withTimeout(setDoc(doc(db, 'users', cred.user.uid), profile), PROFILE_WRITE_TIMEOUT_MS);
    } catch (e) {
      await rollback();
      const denied = getErrorCode(e) === 'firestore/permission-denied';
      throw createAppError(
        'app/profile-save-failed',
        denied
          ? isAsisten
            ? NOT_ALLOWED_ASSISTANT_MESSAGE
            : 'Pendaftaran ditolak oleh aturan keamanan database. Hubungi PM.'
          : 'Profil gagal disimpan. Periksa koneksi internet lalu coba daftar lagi.',
      );
    }
  } finally {
    registering = false;
  }
}

// ─── profil (real-time) ───────────────────────────────────────────────────────

export type ProfileSnapshot = {
  exists: boolean;
  data: Omit<Profile, 'id'> | undefined;
  /** true jika data berasal dari cache lokal (misalnya sedang offline). */
  fromCache: boolean;
};

/** Listener dokumen profil. Kembalikan fungsi unsubscribe. */
export function subscribeProfile(
  uid: string,
  onData: (snap: ProfileSnapshot) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap: DocumentSnapshot) =>
      onData({
        exists: snap.exists(),
        data: snap.data() as Omit<Profile, 'id'> | undefined,
        fromCache: snap.metadata.fromCache,
      }),
    (err: FirestoreError) => onError(err),
  );
}
