// Perhitungan jarak geodetik (Haversine) dan validasi radius lokasi presensi.
// Semua fungsi mengembalikan jarak dalam meter.

const RADIUS_BUMI_METER = 6371000;

/**
 * Konversi derajat ke radian.
 */
function toRad(derajat: number): number {
  return (derajat * Math.PI) / 180;
}

/**
 * Hitung jarak antara dua koordinat (lat1, lng1) dan (lat2, lng2) menggunakan rumus Haversine.
 * Mengembalikan jarak dalam meter.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIUS_BUMI_METER * c;
}

/**
 * Cek apakah posisi (lat, lng) berada dalam radius (meter) dari titik pusat (labLat, labLng).
 */
export function isWithinRadius(
  lat: number,
  lng: number,
  labLat: number,
  labLng: number,
  radiusMeter: number
): boolean {
  return haversineDistance(lat, lng, labLat, labLng) <= radiusMeter;
}

/**
 * Format jarak meter ke string yang mudah dibaca pengguna.
 */
export function formatJarakMeter(jarakMeter: number): string {
  if (jarakMeter < 1000) {
    return `${Math.round(jarakMeter)} m`;
  }
  return `${(jarakMeter / 1000).toFixed(1)} km`;
}