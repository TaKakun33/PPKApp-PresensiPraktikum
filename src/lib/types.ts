import type { KodeKelas, Role, StatusSesi, StatusIzin } from "./constants";

// Profil pengguna — dokumen di koleksi "users", dibuat otomatis saat registrasi (authService.registerUser).
// Praktikan: nim wajib; kelasIds dimulai kosong dan diisi asisten saat menambahkannya sebagai peserta kelas.
// Asisten: tanpa nim/kelasIds (kelas dicari lewat classes.asistenIds); email harus terdaftar di allowedAssistants.
export type Profile = {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nim?: string;
  kelasIds?: string[]; // diisi untuk praktikan agar bisa query sesi
};

// Kelas: ID dokumen = `{praktikumId}_{kode}`, jadi Kelas A–E unik per praktikum.
// asistenIds = asisten pengampu (maksimal 2: pembuat + partner). asistenId = pembuat kelas.
// Kelas lama (sebelum evaluasi Sprint 2) bisa belum punya kode/praktikumId/asistenIds.
export type ClassDoc = {
  id: string; namaKelas: string; praktikum: string; asistenId: string; pesertaIds: string[];
  asistenIds: string[]; kode?: KodeKelas; praktikumId?: string;
};

// Lab praktikum — koleksi "labs", ID dokumen = kode lab (A, B, C, D, AP). Diisi admin.
export type Lab = { kode: string; nama: string; kapasitas: number };

// Sesi: asistenId = asisten yang membuat sesi; semua pengampu kelas boleh mengelolanya.
// labKode + slot (1–5, masing-masing tepat 2 jam) wajib untuk sesi baru; ruangan = nama lab.
export type Session = {
  id: string; praktikum: string; kelasId: string; asistenId: string;
  tanggal: string; waktuMulai: string; waktuSelesai: string; ruangan: string;
  status: StatusSesi; labKode?: string; slot?: number;
};

export type Attendance = {
  id: string; sessionId: string; kelasId: string; userId: string;
  nama: string; nim: string; waktuHadir: unknown;
  // Kode unik sesi yang diketik praktikan saat presensi sendiri (tidak ada pada presensi oleh asisten).
  kode?: string;
  // Hanya ada pada presensi yang dicatat manual oleh asisten (attendanceService.checkInManual).
  manual?: boolean;
  dicatatOleh?: string; // uid asisten yang mencatat
  // Data lokasi presensi (SRS-27): ditambahkan saat praktikan presensi sendiri.
  lokasi?: { lat: number; lng: number };
  akurasiMeter?: number;
  jarakMeter?: number;
};

export type LeaveRequest = {
  id: string; sessionId: string; kelasId: string; asistenId: string; praktikum: string;
  userId: string; nama: string; nim: string; alasan: string;
  kategoriAI: string | null; aiStatus: "berhasil" | "gagal";
  status: StatusIzin; catatanAsisten?: string;
};