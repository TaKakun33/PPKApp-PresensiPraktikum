// FILE AKMAL (feat/peta-lab) — SRS-31, SRS-32.
// Logika murni (tanpa Firebase / React) untuk peta lab: validasi koordinat, area peta, dan penentuan
// praktikum yang sedang berlangsung / berikutnya di sebuah lab. Dipisah supaya mudah diuji dan
// dipakai ulang oleh layar maupun service.
import type { Session } from '../lib/types';
import { waktuWib } from '../services/jadwalService';

export type Koordinat = { lat: number; lng: number };

export type Wilayah = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type AktivitasLab = {
  /** Sesi yang sedang berlangsung di lab ini, atau null jika lab sedang kosong. */
  berlangsung: Session | null;
  /** Sesi yang akan datang (terdekat lebih dulu), dibatasi `BATAS_BERIKUTNYA`. */
  berikutnya: Session[];
};

/** Jumlah sesi "berikutnya" yang ditampilkan per lab. */
export const BATAS_BERIKUTNYA = 3;
/** Jendela waktu (hari ke depan, termasuk hari ini) yang dibaca untuk info aktivitas lab. */
export const JENDELA_HARI = 7;

// Lab Informatika berada dalam satu gedung (hanya puluhan meter satu sama lain), jadi zoom minimum dibuat
// rapat supaya marker tidak menumpuk: ± 90 m untuk tampilan semua lab, ± 45 m saat satu lab dipilih.
const MIN_DELTA = 0.0008;
const DELTA_SATU_TITIK = 0.0004;
const PADDING_WILAYAH = 1.6;

/** Koordinat valid: angka berhingga, dalam rentang bumi, dan bukan titik (0, 0) bawaan. */
export function koordinatValid(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Wilayah peta yang memuat semua titik. Mengembalikan null jika daftar kosong. */
export function wilayahDariKoordinat(titik: Koordinat[]): Wilayah | null {
  if (titik.length === 0) return null;
  const lats = titik.map((t) => t.lat);
  const lngs = titik.map((t) => t.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING_WILAYAH, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING_WILAYAH, MIN_DELTA),
  };
}

/** Wilayah sempit di sekitar satu titik (dipakai saat marker dipilih / pusatkan ke pengguna). */
export function wilayahSekitar(titik: Koordinat, delta = DELTA_SATU_TITIK): Wilayah {
  return { latitude: titik.lat, longitude: titik.lng, latitudeDelta: delta, longitudeDelta: delta };
}

/** "2026-11-30" + 7 hari -> "2026-12-07". Berbasis UTC supaya tidak terpengaruh zona waktu perangkat. */
export function tambahHari(tanggal: string, hari: number): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

/** Tanggal "TTTT-BB-HH" menurut WIB (UTC+7) untuk waktu epoch ms, apa pun zona waktu perangkat. */
export function tanggalWibDari(epochMs: number): string {
  return new Date(epochMs + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Sesi ini milik lab tersebut. Sesi lama tanpa `labKode` dicocokkan lewat nama ruangan. */
export function sesiMilikLab(sesi: Session, lab: { kode: string; nama: string }): boolean {
  if (sesi.labKode) return sesi.labKode === lab.kode;
  return !!sesi.ruangan && sesi.ruangan === lab.nama;
}

function rentangMs(sesi: Session): { mulai: number; selesai: number } | null {
  const mulai = waktuWib(sesi.tanggal, sesi.waktuMulai);
  const selesai = waktuWib(sesi.tanggal, sesi.waktuSelesai);
  return Number.isNaN(mulai) || Number.isNaN(selesai) ? null : { mulai, selesai };
}

/**
 * Tentukan aktivitas sebuah lab pada waktu `sekarang` (epoch ms).
 * - Berlangsung: sesi yang sudah dibuka asisten, atau yang jamnya sedang berjalan tetapi belum dibuka.
 *   Sesi yang sudah ditutup tidak dihitung.
 * - Berikutnya: sesi belum dibuka yang jam mulainya di masa depan, terdekat lebih dulu.
 */
export function hitungAktivitasLab(
  semuaSesi: Session[],
  lab: { kode: string; nama: string },
  sekarang: number,
): AktivitasLab {
  const berlangsung: { sesi: Session; mulai: number }[] = [];
  const berikutnya: { sesi: Session; mulai: number }[] = [];

  for (const sesi of semuaSesi) {
    if (!sesiMilikLab(sesi, lab) || sesi.status === 'ditutup') continue;
    const rentang = rentangMs(sesi);
    if (!rentang) continue;

    if (sesi.status === 'dibuka' || (sesi.status === 'belum_dibuka' && sekarang >= rentang.mulai && sekarang < rentang.selesai)) {
      berlangsung.push({ sesi, mulai: rentang.mulai });
    } else if (sesi.status === 'belum_dibuka' && rentang.mulai > sekarang) {
      berikutnya.push({ sesi, mulai: rentang.mulai });
    }
  }

  // Jika (karena data tidak wajar) ada lebih dari satu, utamakan yang sudah dibuka.
  berlangsung.sort((a, b) => Number(b.sesi.status === 'dibuka') - Number(a.sesi.status === 'dibuka') || b.mulai - a.mulai);
  berikutnya.sort((a, b) => a.mulai - b.mulai);

  return {
    berlangsung: berlangsung[0]?.sesi ?? null,
    berikutnya: berikutnya.slice(0, BATAS_BERIKUTNYA).map((x) => x.sesi),
  };
}
