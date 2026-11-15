// Kode unik presensi: 5 karakter, hanya angka dan huruf besar (A-Z, 0-9).
// Dibuat otomatis saat sesi dibuka, ditampilkan ke asisten di layar Presensi,
// lalu dimasukkan praktikan saat presensi. Pencocokannya ditegakkan firestore.rules.

export const KODE_PRESENSI_PANJANG = 5;

// Karakter yang mirip (0/O, 1/I) dihilangkan supaya kode mudah dibaca dan diketik.
// Hasilnya tetap lolos pola rules ^[A-Z0-9]{5}$.
const KARAKTER_KODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function buatKodePresensi(): string {
  let kode = '';
  for (let i = 0; i < KODE_PRESENSI_PANJANG; i++) {
    kode += KARAKTER_KODE.charAt(Math.floor(Math.random() * KARAKTER_KODE.length));
  }
  return kode;
}

/** Rapikan isian praktikan: huruf jadi kapital, selain huruf/angka dibuang, maksimal 5 karakter. */
export function normalisasiKode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, KODE_PRESENSI_PANJANG);
}

export function kodePresensiValid(kode: string): boolean {
  return /^[A-Z0-9]{5}$/.test(kode);
}
