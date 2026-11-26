// Pengelompokan sesi untuk daftar jadwal (layar Jadwal asisten dan Home praktikan).
// Logika murni: tanggal "hari ini" diberikan dari luar (WIB) supaya tidak bergantung zona waktu perangkat.
import type { Session } from '../lib/types';
import { waktuWib } from '../services/jadwalService';
import { sesiLupaDitutup } from '../services/sessionService';
import { tanggalWibDari } from './aktivitasLab';

export type KunciKelompok = 'dibuka' | 'hariIni' | 'akanDatang' | 'terlewat' | 'ditutup';

export type KelompokSesi = {
  key: KunciKelompok;
  judul: string;
  /** Penjelasan singkat di bawah judul kelompok. */
  keterangan: string;
  data: Session[];
};

const urutanNaik = (a: Session, b: Session) =>
  `${a.tanggal} ${a.waktuMulai}`.localeCompare(`${b.tanggal} ${b.waktuMulai}`);
const urutanTurun = (a: Session, b: Session) => urutanNaik(b, a);

/**
 * Kelompokkan sesi, urut dari yang paling perlu perhatian:
 * - dibuka     : sesi sedang dibuka (presensi berjalan)
 * - hariIni    : belum dibuka, jadwalnya hari ini dan jam selesainya belum lewat (belum mulai / sudah waktunya)
 * - akanDatang : belum dibuka, jadwalnya setelah hari ini
 * - terlewat   : belum pernah dibuka dan jam selesainya (WIB) sudah lewat, baik hari ini maupun sebelumnya
 * - ditutup    : sudah ditutup (termasuk sesi dibuka yang lupa ditutup lebih dari 1 jam)
 * Kelompok kosong tidak dikembalikan.
 */
export function kelompokkanSesi(sesi: Session[], sekarang: number = Date.now()): KelompokSesi[] {
  const hariIni = tanggalWibDari(sekarang);
  const dibuka: Session[] = [];
  const hariIniList: Session[] = [];
  const akanDatang: Session[] = [];
  const terlewat: Session[] = [];
  const ditutup: Session[] = [];

  for (const item of sesi) {
    if (item.status === 'ditutup' || sesiLupaDitutup(item)) ditutup.push(item);
    else if (item.status === 'dibuka') dibuka.push(item);
    else if (item.tanggal < hariIni || sekarang >= waktuWib(item.tanggal, item.waktuSelesai)) terlewat.push(item);
    else if (item.tanggal === hariIni) hariIniList.push(item);
    else akanDatang.push(item);
  }

  const semua: KelompokSesi[] = [
    { key: 'dibuka', judul: 'Sedang dibuka', keterangan: 'Presensi sedang berjalan', data: dibuka.sort(urutanNaik) },
    { key: 'hariIni', judul: 'Hari ini', keterangan: 'Belum dibuka, jadwalnya hari ini', data: hariIniList.sort(urutanNaik) },
    { key: 'akanDatang', judul: 'Akan datang', keterangan: 'Jadwal setelah hari ini', data: akanDatang.sort(urutanNaik) },
    { key: 'terlewat', judul: 'Terlewat', keterangan: 'Jam sesi sudah lewat dan tidak pernah dibuka', data: terlewat.sort(urutanTurun) },
    { key: 'ditutup', judul: 'Sudah ditutup', keterangan: 'Sesi yang sudah selesai', data: ditutup.sort(urutanTurun) },
  ];
  return semua.filter((k) => k.data.length > 0);
}
