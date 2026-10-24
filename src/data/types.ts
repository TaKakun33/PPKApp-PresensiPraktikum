// FILE MILIK PM - jangan diedit anggota lain.
// Butuh field baru? Minta ke PM.

export type Role = 'asisten' | 'praktikan';

export type SessionStatus = 'Belum Dibuka' | 'Dibuka' | 'Ditutup';

export type User = {
  id: string;
  name: string;
  role: Role;
  nim?: string; // hanya praktikan
  kelas?: string; // hanya praktikan, contoh: 'A'
  kelasDiampu?: string[]; // hanya asisten, contoh: ['A']
};

export type Session = {
  id: string;
  praktikum: string;
  kelas: string;
  tanggal: string; // teks siap tampil, contoh: '24 Okt 2026'
  waktu: string; // teks siap tampil, contoh: '08.00 - 10.00'
  ruangan: string;
  asistenId: string;
  asistenNama: string;
  status: SessionStatus;
};

export type Attendance = {
  id: string;
  sessionId: string;
  userId: string;
  waktuHadir: string; // ISO string dari new Date().toISOString()
};

// Hasil dari checkIn(): cek `ok` dulu sebelum membaca field lain.
export type CheckInResult =
  | { ok: true; attendance: Attendance }
  | { ok: false; message: string };

// Hasil dari openSession() / closeSession().
export type ActionResult = { ok: boolean; message: string };

// Satu baris di layar Rekap (asisten).
export type RecapItem = { attendance: Attendance; user: User };

// Satu baris di layar Riwayat (praktikan).
export type HistoryItem = { attendance: Attendance; session: Session };
