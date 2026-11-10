import type { Role, StatusSesi, StatusIzin } from "./constants";

// Profil pengguna — dokumen di koleksi "users", dibuat manual admin.
// Praktikan: kelasIds wajib diisi (array kelasId yang diikuti).
// Asisten: kelasIds opsional (sesi dicari via asistenId).
export type Profile = {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nim?: string;
  kelasIds?: string[]; // diisi untuk praktikan agar bisa query sesi
};

export type ClassDoc = {
  id: string; namaKelas: string; praktikum: string; asistenId: string; pesertaIds: string[];
};

export type Session = {
  id: string; praktikum: string; kelasId: string; asistenId: string;
  tanggal: string; waktuMulai: string; waktuSelesai: string; ruangan: string;
  status: StatusSesi;
};

export type Attendance = {
  id: string; sessionId: string; kelasId: string; userId: string;
  nama: string; nim: string; waktuHadir: unknown;
};

export type LeaveRequest = {
  id: string; sessionId: string; kelasId: string; asistenId: string; praktikum: string;
  userId: string; nama: string; nim: string; alasan: string;
  kategoriAI: string | null; aiStatus: "berhasil" | "gagal";
  status: StatusIzin; catatanAsisten?: string;
};