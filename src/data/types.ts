// FILE MILIK PM - jangan diedit anggota lain.
// Butuh field baru? Minta ke PM.
//
// Struktur data mengikuti database-dummy-PPKApp.xlsx (pola relasional, siap dipindah ke DB/API):
//   master      : TahunAjaran, Praktikum, Modul, Kelas, Ruangan, User (asisten + praktikan)
//   relasi N:M  : Pendaftaran (praktikan - kelas), Penugasan (asisten - kelas)
//   transaksi   : SessionData (jadwal sesi), Attendance (presensi)
// Tabel lookup peran dan status_sesi berupa union type (Role, SessionStatus);
// label tampilan status ada di STATUS_LABEL (constants/colors.ts).
// `Session` = SessionData + field turunan untuk tampilan (dihitung di AppContext).
// Layar membaca `Session`, bukan SessionData.
//
// Penamaan: istilah domain memakai bahasa Indonesia (kelas, ruangan, modul),
// sufiks teknis memakai bahasa Inggris (Id, At).

export type Role = 'asisten' | 'praktikan';

export type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';

// ---------- data master ----------

export type TahunAjaran = {
  id: string;
  tahun: string; // '2026/2027'
  semester: 'Ganjil' | 'Genap';
  isAktif: boolean;
};

export type Praktikum = {
  id: string;
  kode: string; // 'PPK'
  nama: string; // 'Praktikum PPK'
};

export type Modul = {
  id: string;
  praktikumId: string; // FK ke Praktikum.id
  nomor: number; // modul ke-berapa dalam praktikum
  judul: string;
};

// Kelas milik satu praktikum dan satu tahun ajaran (kode 'A' di PPK berbeda dengan 'A' di Basis Data).
export type Kelas = {
  id: string;
  praktikumId: string; // FK ke Praktikum.id
  tahunAjaranId: string; // FK ke TahunAjaran.id
  kode: string; // 'A', 'B', 'C'
};

export type Ruangan = {
  id: string;
  nama: string;
  kapasitas: number;
};

type BaseUser = { id: string; nim: string; nama: string; email: string };
export type Asisten = BaseUser & { role: 'asisten' };
export type Praktikan = BaseUser & { role: 'praktikan' };
export type User = Asisten | Praktikan;

// ---------- relasi N:M ----------
// Unik per (userId, kelasId).

export type Pendaftaran = { id: string; userId: string; kelasId: string }; // praktikan terdaftar di kelas
export type Penugasan = { id: string; userId: string; kelasId: string }; // asisten ditugaskan di kelas

// ---------- sesi ----------

// Bentuk yang disimpan (state/DB). Tidak ada teks tampilan di sini.
// Praktikum diturunkan dari kelas/modul, tidak disimpan di sesi.
// Asisten pengampu = asistenId (harus punya Penugasan di kelasId).
export type SessionData = {
  id: string;
  kelasId: string; // FK ke Kelas.id
  modulId: string; // FK ke Modul.id
  ruanganId: string; // FK ke Ruangan.id
  asistenId: string; // FK ke User.id (asisten)
  startAt: string; // jadwal mulai, ISO 8601 (di DB: simpan UTC / timestamptz)
  endAt: string; // jadwal selesai
  status: SessionStatus;
  openedAt?: string; // diisi store saat asisten membuka sesi
  closedAt?: string; // diisi store saat asisten menutup sesi
};

// Bentuk yang dibaca layar = SessionData + field turunan.
export type Session = SessionData & {
  praktikum: string; // teks siap tampil, contoh: 'Praktikum PPK - Modul 2'
  judulModul: string; // contoh: 'Komponen dan Tata Letak'
  kelas: string; // kode kelas, contoh: 'A'
  ruangan: string; // nama ruangan, contoh: 'Lab Komputer 1'
  tanggal: string; // teks siap tampil, contoh: '24 Okt 2026'
  waktu: string; // teks siap tampil, contoh: '08.00 - 10.00'
  asistenNama: string; // nama asisten hasil lookup dari asistenId
};

// ---------- presensi ----------

// Aturan: maksimal 1 baris per (sessionId, userId). id deterministik: att-<sessionId>-<userId>.
export type Attendance = {
  id: string;
  sessionId: string; // FK ke SessionData.id
  userId: string; // FK ke Praktikan.id
  waktuHadir: string; // ISO 8601, dari new Date().toISOString()
};

// Hasil dari checkIn(): cek `ok` dulu sebelum membaca field lain.
export type CheckInResult =
  | { ok: true; attendance: Attendance }
  | { ok: false; message: string };

// Hasil dari openSession() / closeSession().
export type ActionResult = { ok: boolean; message: string };

// Satu baris di layar Rekap (asisten).
export type RecapItem = { attendance: Attendance; user: Praktikan };

// Satu baris di layar Riwayat (praktikan).
export type HistoryItem = { attendance: Attendance; session: Session };

// Kelas milik pengguna aktif + nama praktikumnya (dari getKelasSaya).
export type KelasInfo = Kelas & { praktikum: string };
