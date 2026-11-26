// Helper rekap kehadiran satu sesi, dipakai layar Rekap (hanya lihat) dan Presensi (ubah).
import { STATUS_IZIN } from '../lib/constants';
import type { Attendance, LeaveRequest, Profile, Session } from '../lib/types';
import { waktuWib } from '../services/jadwalService';
import { formatTanggalJam } from './format';

export function toDateFromValue(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  if (typeof value === 'object') {
    const maybeDate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof maybeDate.toDate === 'function') {
      return maybeDate.toDate();
    }

    if (typeof maybeDate.seconds === 'number') {
      return new Date(maybeDate.seconds * 1000);
    }
  }

  return null;
}

export function normalizeTimestamp(value: unknown): string {
  const date = toDateFromValue(value);
  if (!date) return '—';
  return formatTanggalJam(date.toISOString());
}

export type RekapStatus = 'hadir' | 'izin' | 'belum' | 'tidak';

export type RekapRow = {
  key: string;
  nama: string;
  nim: string;
  status: RekapStatus;
  waktuTampil: string;
  waktuMs: number;
  /** Presensi dicatat manual oleh asisten (bukan presensi sendiri oleh praktikan). */
  manual: boolean;
  /** Dokumen izin ajuan praktikan di sesi ini (status apa pun), atau null. */
  leave: LeaveRequest | null;
};

export const REKAP_LABEL: Record<RekapStatus, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  belum: 'Belum hadir',
  tidak: 'Tidak hadir',
};

export const REKAP_ORDER: Record<RekapStatus, number> = { hadir: 0, izin: 1, belum: 2, tidak: 3 };

/** Sesi dianggap sudah lewat waktunya jika tanggal + waktuSelesai (WIB, apa pun zona waktu perangkat) sudah terlewati. */
export function waktuSesiLewat(session: Session | null, now: number): boolean {
  if (!session) return false;
  const tgl = /^(\d{4})-(\d{2})-(\d{2})$/.exec(session.tanggal ?? '');
  const jam = /^(\d{1,2}):(\d{2})$/.exec((session.waktuSelesai ?? '').replace('.', ':'));
  if (!tgl || !jam) return false;
  const akhir = waktuWib(session.tanggal, `${jam[1]}:${jam[2]}`);
  return now > akhir;
}

/**
 * Gabungkan peserta kelas + presensi + izin menjadi satu daftar rekap.
 * Prioritas status: Hadir > Izin (hanya yang DITERIMA) > Tidak hadir (sesi selesai) > Belum hadir.
 * "Tidak hadir" tidak disimpan di database; ia hanya hasil perhitungan saat sesi sudah ditutup atau
 * waktunya lewat dan praktikan tidak punya presensi maupun izin diterima.
 * Praktikan yang tidak ada di daftar peserta tetap tampil jika sudah presensi.
 */
export function buildRekap(
  peserta: Profile[],
  attendances: Attendance[],
  izinSesi: LeaveRequest[],
  sesiSelesai: boolean
): RekapRow[] {
  const hadirByUser = new Map(attendances.map((a) => [a.userId, a]));
  const izinByUser = new Map(izinSesi.map((l) => [l.userId, l]));
  const rows = new Map<string, RekapRow>();

  for (const p of peserta) {
    const att = hadirByUser.get(p.id);
    const leave = izinByUser.get(p.id) ?? null;
    const waktu = att ? toDateFromValue(att.waktuHadir) : null;
    const izinDiterima = leave?.status === STATUS_IZIN.DITERIMA;
    rows.set(p.id, {
      key: p.id,
      nama: p.nama,
      nim: p.nim ?? '',
      status: att ? 'hadir' : izinDiterima ? 'izin' : sesiSelesai ? 'tidak' : 'belum',
      waktuTampil: att ? normalizeTimestamp(att.waktuHadir) : '—',
      waktuMs: waktu?.getTime() ?? Number.MAX_SAFE_INTEGER,
      manual: att?.manual === true,
      leave,
    });
  }

  for (const att of attendances) {
    if (rows.has(att.userId)) continue;
    const waktu = toDateFromValue(att.waktuHadir);
    rows.set(att.userId, {
      key: att.userId,
      nama: att.nama || '(tanpa nama)',
      nim: att.nim ?? '',
      status: 'hadir',
      waktuTampil: normalizeTimestamp(att.waktuHadir),
      waktuMs: waktu?.getTime() ?? Number.MAX_SAFE_INTEGER,
      manual: att.manual === true,
      leave: izinByUser.get(att.userId) ?? null,
    });
  }

  return [...rows.values()].sort(
    (a, b) =>
      REKAP_ORDER[a.status] - REKAP_ORDER[b.status] ||
      (a.status === 'hadir' ? a.waktuMs - b.waktuMs : a.nama.localeCompare(b.nama))
  );
}
