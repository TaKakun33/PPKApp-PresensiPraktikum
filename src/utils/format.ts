// FILE MILIK PM - helper format waktu supaya semua layar tampil sama.

const pad = (n: number) => String(n).padStart(2, '0');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// '2026-10-24T08:05:12' -> '08.05.12'
export function formatJam(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

// '2026-10-24T08:05:12' -> '24 Okt 2026, 08.05.12'
export function formatTanggalJam(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${formatJam(iso)}`;
}

// '2026-10-24T08:00:00' -> '24 Okt 2026'
export function formatTanggal(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// ('2026-10-24T08:00:00', '2026-10-24T10:00:00') -> '08.00 - 10.00'
export function formatRentangWaktu(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  };
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}
