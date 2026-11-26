// Layanan lokasi perangkat untuk presensi (SRS-27, SRS-28).
// Tangani izin lokasi, ambil posisi, GPS mati, lokasi tidak tersedia,
// timeout/offline, dan mapping error ke pesan UI yang ramah.
// Tidak mengubah data Firestore — hanya bacaan lokasi perangkat.

import * as Location from 'expo-location';
import { haversineDistance, isWithinRadius } from '../utils/geo';

export type LokasiStatus =
  | { status: 'siap'; lokasi: LokasiPosisi; message?: string }
  | { status: 'izin_ditolak'; message?: string }
  | { status: 'gps_mati'; message?: string }
  | { status: 'lokasi_tidak_tersedia'; message?: string }
  | { status: 'timeout'; message?: string }
  | { status: 'offline'; message?: string }
  | { status: 'error'; message: string };

export type LokasiPosisi = {
  lat: number;
  lng: number;
  akurasiMeter: number;
  timestamp: number;
};

const LOCATION_TIMEOUT_MS = 15000;

export function pesanStatusLokasi(status: LokasiStatus): string {
  switch (status.status) {
    case 'siap':
      return 'Lokasi siap.';
    case 'izin_ditolak':
      return 'Izin lokasi ditolak. Aktifkan izin lokasi pengaturan aplikasi.';
    case 'gps_mati':
      return 'GPS / layanan lokasi mati. Nyalakan lokasi perangkat.';
    case 'lokasi_tidak_tersedia':
      return 'Lokasi tidak tersedia. Coba lagi atau periksa pengaturan lokasi.';
    case 'timeout':
      return 'Pengambilan lokasi melebihi batas waktu. Periksa GPS dan coba lagi.';
    case 'offline':
      return 'Koneksi terputus. Lokasi tidak dapat ditentukan saat ini.';
    case 'error':
      return status.message;
    default:
      return 'Terjadi kesalahan saat mengambil lokasi.';
  }
}

export function ikonStatusLokasi(status: LokasiStatus): string {
  switch (status.status) {
    case 'siap':
      return 'location-outline';
    case 'izin_ditolak':
      return 'location-off-outline';
    case 'gps_mati':
      return 'remove-circle-outline';
    case 'lokasi_tidak_tersedia':
      return 'help-outline';
    case 'timeout':
      return 'time-outline';
    case 'offline':
      return 'cloud-offline-outline';
    case 'error':
      return 'alert-circle-outline';
    default:
      return 'information-circle-outline';
  }
}

export function nadaStatusLokasi(status: LokasiStatus): 'info' | 'peringatan' | 'bahaya' {
  switch (status.status) {
    case 'siap':
      return 'info';
    case 'izin_ditolak':
    case 'gps_mati':
    case 'lokasi_tidak_tersedia':
    case 'timeout':
    case 'offline':
    case 'error':
      return 'bahaya';
    default:
      return 'peringatan';
  }
}

async function layananLokasiDiaktifkan(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

async function cekIzinLokasi(): Promise<Location.PermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

async function mintaIzinLokasi(): Promise<Location.PermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

async function ambilPosisiDenganTimeout(): Promise<{
  lokasi?: LokasiPosisi;
  error?: Error;
}> {
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new Error('LOKASI_TIMEOUT'));
    }, LOCATION_TIMEOUT_MS);
  });

  try {
    const posisi = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      timeoutPromise,
    ]);

    if (timeoutTimer) clearTimeout(timeoutTimer);

    return {
      lokasi: {
        lat: posisi.coords.latitude,
        lng: posisi.coords.longitude,
        akurasiMeter: posisi.coords.accuracy ?? 0,
        timestamp: posisi.timestamp,
      },
    };
  } catch (error: any) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    return { error: error as Error };
  }
}

/**
 * Ambil status lokasi lengkap: cek izin, GPS, lalu ambil posisi.
 * Digunakan oleh CheckInScreen sebelum tombol presensi diizinkan.
 */
export async function ambilStatusLokasi(): Promise<LokasiStatus> {
  const aktif = await layananLokasiDiaktifkan();
  if (!aktif) {
    return { status: 'gps_mati' };
  }

  let izinStatus = await cekIzinLokasi();
  if (izinStatus === 'denied') {
    return { status: 'izin_ditolak' };
  }
  if (izinStatus === 'undetermined') {
    izinStatus = await mintaIzinLokasi();
    if (izinStatus !== 'granted') {
      return { status: 'izin_ditolak' };
    }
  }

  const hasil = await ambilPosisiDenganTimeout();
  if (hasil.error) {
    const msg = (hasil.error as Error).message;
    if (msg === 'LOKASI_TIMEOUT') {
      return { status: 'timeout' };
    }
    return { status: 'lokasi_tidak_tersedia', message: hasil.error.message };
  }

  return { status: 'siap', lokasi: hasil.lokasi! };
}

/**
 * Hitung jarak dari posisi pengguna ke lokasi lab.
 */
export function hitungJarakKeLab(
  lokasi: LokasiPosisi,
  labLat: number,
  labLng: number,
  radiusMeter: number
): { jarakMeter: number; dalamRadius: boolean } {
  const jarak = haversineDistance(lokasi.lat, lokasi.lng, labLat, labLng);
  return {
    jarakMeter: Math.round(jarak),
    dalamRadius: isWithinRadius(lokasi.lat, lokasi.lng, labLat, labLng, radiusMeter),
  };
}