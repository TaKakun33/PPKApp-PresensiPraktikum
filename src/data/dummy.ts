// FILE MILIK PM - jangan diedit anggota lain.
import type { Attendance, Session, User } from './types';

export const ASISTEN: User[] = [
  { id: 'a1', name: 'Kak Raka Pratama', role: 'asisten', kelasDiampu: ['A'] },
  // Asisten 2 mengampu kelas B yang TIDAK punya sesi -> untuk tes empty state
  { id: 'a2', name: 'Kak Sinta Maharani', role: 'asisten', kelasDiampu: ['B'] },
];

export const PRAKTIKAN: User[] = [
  { id: 'p1', name: 'Andi Saputra', role: 'praktikan', nim: '2400001', kelas: 'A' },
  { id: 'p2', name: 'Budi Santoso', role: 'praktikan', nim: '2400002', kelas: 'A' },
  { id: 'p3', name: 'Citra Lestari', role: 'praktikan', nim: '2400003', kelas: 'A' },
  { id: 'p4', name: 'Dewi Anggraini', role: 'praktikan', nim: '2400004', kelas: 'B' },
  { id: 'p5', name: 'Eko Prasetyo', role: 'praktikan', nim: '2400005', kelas: 'B' },
  { id: 'p6', name: 'Fira Maulida', role: 'praktikan', nim: '2400006', kelas: 'B' },
];

export const ALL_USERS: User[] = [...ASISTEN, ...PRAKTIKAN];

// 5 sesi, semuanya kelas A. Kelas B sengaja tanpa sesi (tes empty state jadwal).
export const INITIAL_SESSIONS: Session[] = [
  {
    id: 's1',
    praktikum: 'Praktikum PPK - Modul 1',
    kelas: 'A',
    tanggal: '17 Okt 2026',
    waktu: '08.00 - 10.00',
    ruangan: 'Lab Komputer 1',
    asistenId: 'a1',
    asistenNama: 'Kak Raka Pratama',
    status: 'Ditutup',
  },
  {
    id: 's2',
    praktikum: 'Praktikum PPK - Modul 2',
    kelas: 'A',
    tanggal: '24 Okt 2026',
    waktu: '08.00 - 10.00',
    ruangan: 'Lab Komputer 1',
    asistenId: 'a1',
    asistenNama: 'Kak Raka Pratama',
    status: 'Dibuka', // sesi yang sudah dibuka -> presensi bisa langsung dites
  },
  {
    id: 's3',
    praktikum: 'Praktikum PPK - Modul 3',
    kelas: 'A',
    tanggal: '31 Okt 2026',
    waktu: '08.00 - 10.00',
    ruangan: 'Lab Komputer 1',
    asistenId: 'a1',
    asistenNama: 'Kak Raka Pratama',
    status: 'Belum Dibuka',
  },
  {
    id: 's4',
    praktikum: 'Praktikum PPK - Modul 4',
    kelas: 'A',
    tanggal: '7 Nov 2026',
    waktu: '08.00 - 10.00',
    ruangan: 'Lab Komputer 2',
    asistenId: 'a1',
    asistenNama: 'Kak Raka Pratama',
    status: 'Belum Dibuka',
  },
  {
    id: 's5',
    praktikum: 'Praktikum PPK - Modul 5',
    kelas: 'A',
    tanggal: '14 Nov 2026',
    waktu: '08.00 - 10.00',
    ruangan: 'Lab Komputer 2',
    asistenId: 'a1',
    asistenNama: 'Kak Raka Pratama',
    status: 'Belum Dibuka',
  },
];

// Riwayat awal: p1 dan p3 hadir di Modul 1.
// p2 belum pernah presensi -> tes empty state riwayat.
// Sesi s2 (Dibuka) belum punya presensi -> tes empty state rekap.
export const INITIAL_ATTENDANCES: Attendance[] = [
  { id: 'att1', sessionId: 's1', userId: 'p1', waktuHadir: '2026-10-17T08:05:12.000+07:00' },
  { id: 'att2', sessionId: 's1', userId: 'p3', waktuHadir: '2026-10-17T08:09:40.000+07:00' },
];
