// FILE AKMAL (feat/auth-leave-ai) — helper kecil yang dipakai authService, leaveService, aiService.
// Isinya: error aplikasi dengan kode, batas waktu (timeout) untuk promise, dan pemetaan error ke pesan ramah.

export type CodedError = Error & { code: string };

/** Buat error aplikasi sendiri. Kode berawalan "app/" dan message-nya sudah siap ditampilkan ke pengguna. */
export function createAppError(code: string, message: string): CodedError {
  return Object.assign(new Error(message), { code });
}

export function getErrorCode(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

/**
 * Batasi waktu tunggu sebuah promise.
 * Penting untuk Firestore: saat offline, operasi tulis TIDAK gagal, promise-nya menggantung
 * sampai koneksi kembali. Tanpa timeout, tombol kirim akan loading selamanya.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(createAppError('app/timeout', 'Waktu tunggu habis.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isTimeoutError(e: unknown): boolean {
  return getErrorCode(e) === 'app/timeout';
}

/** Pesan ramah untuk error Firestore / jaringan / error aplikasi. */
export function getFriendlyError(e: unknown, fallback: string): string {
  const code = getErrorCode(e);

  if (code.startsWith('app/') && code !== 'app/timeout' && e instanceof Error && e.message) {
    return e.message;
  }

  switch (code) {
    case 'firestore/permission-denied':
      return 'Akses ditolak. Kamu tidak memiliki izin untuk tindakan ini.';
    case 'firestore/unauthenticated':
      return 'Sesi login berakhir. Silakan login kembali.';
    case 'firestore/unavailable':
    case 'firestore/deadline-exceeded':
    case 'app/timeout':
      return 'Koneksi bermasalah. Periksa internet kamu lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Periksa koneksi internet kamu.';
    default:
      return fallback;
  }
}
