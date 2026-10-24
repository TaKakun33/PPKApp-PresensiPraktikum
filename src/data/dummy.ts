// FILE MILIK PM - jangan diedit anggota lain.
// Data dummy sementara (belum pakai database), mengikuti database-dummy-PPKApp.xlsx.
// Tanggal mengikuti jadwal nyata di sekitar 24 Okt 2026. Semua waktu ISO 8601 dengan offset WIB (+07:00).
// ID berupa teks (u = pengguna, k = kelas, s = sesi, ...) agar cocok dengan parameter URL /session/s2.
import type {
  Asisten,
  Attendance,
  Kelas,
  Modul,
  Pendaftaran,
  Penugasan,
  Praktikan,
  Praktikum,
  Ruangan,
  SessionData,
  TahunAjaran,
  User,
} from './types';

// ---------- master: tahun ajaran ----------
// ta0 = tahun ajaran lalu (tidak aktif) -> tes filter getKelasSaya.
export const TAHUN_AJARAN: TahunAjaran[] = [
  { id: 'ta0', tahun: '2025/2026', semester: 'Genap', isAktif: false },
  { id: 'ta1', tahun: '2026/2027', semester: 'Ganjil', isAktif: true },
];

// ---------- master: praktikum ----------
export const PRAKTIKUM: Praktikum[] = [
  { id: 'pr1', kode: 'PPK', nama: 'Praktikum PPK' },
  { id: 'pr2', kode: 'BD', nama: 'Praktikum Basis Data' },
];

// ---------- master: modul (per praktikum) ----------
export const MODUL: Modul[] = [
  { id: 'm1', praktikumId: 'pr1', nomor: 1, judul: 'Pengenalan dan Persiapan Lingkungan' },
  { id: 'm2', praktikumId: 'pr1', nomor: 2, judul: 'Komponen dan Tata Letak' },
  { id: 'm3', praktikumId: 'pr1', nomor: 3, judul: 'Navigasi Antar Layar' },
  { id: 'm4', praktikumId: 'pr1', nomor: 4, judul: 'State dan Context' },
  { id: 'm5', praktikumId: 'pr1', nomor: 5, judul: 'Integrasi Data' },
  { id: 'm6', praktikumId: 'pr2', nomor: 1, judul: 'Pemodelan Data dan ERD' },
  { id: 'm7', praktikumId: 'pr2', nomor: 2, judul: 'Normalisasi' },
  { id: 'm8', praktikumId: 'pr2', nomor: 3, judul: 'SQL Dasar' },
  { id: 'm9', praktikumId: 'pr2', nomor: 4, judul: 'Join dan Subquery' },
];

// ---------- master: kelas (milik satu praktikum dan satu tahun ajaran) ----------
// Kelas C (PPK) sengaja TANPA sesi -> tes empty state jadwal praktikan.
export const KELAS: Kelas[] = [
  { id: 'k1', praktikumId: 'pr1', tahunAjaranId: 'ta1', kode: 'A' },
  { id: 'k2', praktikumId: 'pr1', tahunAjaranId: 'ta1', kode: 'B' },
  { id: 'k3', praktikumId: 'pr1', tahunAjaranId: 'ta1', kode: 'C' },
  { id: 'k4', praktikumId: 'pr2', tahunAjaranId: 'ta1', kode: 'A' },
  { id: 'k5', praktikumId: 'pr2', tahunAjaranId: 'ta1', kode: 'B' },
  // Kelas tahun ajaran lalu (tidak aktif): tidak boleh muncul di getKelasSaya.
  { id: 'k6', praktikumId: 'pr1', tahunAjaranId: 'ta0', kode: 'A' },
  { id: 'k7', praktikumId: 'pr2', tahunAjaranId: 'ta0', kode: 'A' },
];

// ---------- master: ruangan ----------
export const RUANGAN: Ruangan[] = [
  { id: 'r1', nama: 'Lab Komputer 1', kapasitas: 30 },
  { id: 'r2', nama: 'Lab Komputer 2', kapasitas: 30 },
  { id: 'r3', nama: 'Lab Komputer 3', kapasitas: 25 },
  { id: 'r4', nama: 'Lab Basis Data', kapasitas: 20 },
];

// ---------- master: pengguna (asisten dan praktikan dalam satu daftar) ----------
// u1-u5 asisten, u6-u36 praktikan. u5 (Bima) belum punya sesi -> tes empty state asisten.
// u10 bernama panjang -> tes teks terpotong. u7 hadir di satu sesi, u9 belum pernah presensi.
export const PENGGUNA: User[] = [
  { id: 'u1', nim: '2300101', nama: 'Raka Pratama', email: 'raka.pratama@example.com', role: 'asisten' },
  { id: 'u2', nim: '2300102', nama: 'Sinta Maharani', email: 'sinta.maharani@example.com', role: 'asisten' },
  { id: 'u3', nim: '2300103', nama: 'Dimas Aryo Wibisono', email: 'dimas.wibisono@example.com', role: 'asisten' },
  { id: 'u4', nim: '2300104', nama: 'Laras Setyowati', email: 'laras.setyowati@example.com', role: 'asisten' },
  { id: 'u5', nim: '2300105', nama: 'Bima Aditya', email: 'bima.aditya@example.com', role: 'asisten' },
  { id: 'u6', nim: '2400001', nama: 'Andi Saputra', email: 'andi.saputra@example.com', role: 'praktikan' },
  { id: 'u7', nim: '2400002', nama: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'praktikan' },
  { id: 'u8', nim: '2400003', nama: 'Citra Lestari', email: 'citra.lestari@example.com', role: 'praktikan' },
  { id: 'u9', nim: '2400004', nama: 'Dewi Anggraini', email: 'dewi.anggraini@example.com', role: 'praktikan' },
  { id: 'u10', nim: '2400005', nama: 'Muhammad Farhan Nur Rahmat Hidayatullah', email: 'farhan.hidayatullah@example.com', role: 'praktikan' },
  { id: 'u11', nim: '2400006', nama: 'Eko Prasetyo', email: 'eko.prasetyo@example.com', role: 'praktikan' },
  { id: 'u12', nim: '2400007', nama: 'Fira Maulida', email: 'fira.maulida@example.com', role: 'praktikan' },
  { id: 'u13', nim: '2400008', nama: 'Gilang Ramadhan', email: 'gilang.ramadhan@example.com', role: 'praktikan' },
  { id: 'u14', nim: '2400009', nama: 'Hana Permatasari', email: 'hana.permatasari@example.com', role: 'praktikan' },
  { id: 'u15', nim: '2400010', nama: 'Indra Kusuma', email: 'indra.kusuma@example.com', role: 'praktikan' },
  { id: 'u16', nim: '2400011', nama: 'Julia Rahmawati', email: 'julia.rahmawati@example.com', role: 'praktikan' },
  // u17-u36: tambahan agar PPK-A berisi 25 praktikan -> tes daftar panjang/scroll di Rekap.
  { id: 'u17', nim: '2400012', nama: 'Kevin Alexander', email: 'kevin.alexander@example.com', role: 'praktikan' },
  { id: 'u18', nim: '2400013', nama: 'Lina Marlina', email: 'lina.marlina@example.com', role: 'praktikan' },
  { id: 'u19', nim: '2400014', nama: 'Mario Gunawan', email: 'mario.gunawan@example.com', role: 'praktikan' },
  { id: 'u20', nim: '2400015', nama: 'Nadia Putri Anjani', email: 'nadia.anjani@example.com', role: 'praktikan' },
  { id: 'u21', nim: '2400016', nama: 'Oka Wijaya', email: 'oka.wijaya@example.com', role: 'praktikan' },
  { id: 'u22', nim: '2400017', nama: 'Putu Ayu Sekar', email: 'putu.sekar@example.com', role: 'praktikan' },
  { id: 'u23', nim: '2400018', nama: 'Qori Zahra', email: 'qori.zahra@example.com', role: 'praktikan' },
  { id: 'u24', nim: '2400019', nama: 'Rizky Firmansyah', email: 'rizky.firmansyah@example.com', role: 'praktikan' },
  { id: 'u25', nim: '2400020', nama: 'Salsabila Nurul', email: 'salsabila.nurul@example.com', role: 'praktikan' },
  { id: 'u26', nim: '2400021', nama: 'Taufik Hidayat', email: 'taufik.hidayat@example.com', role: 'praktikan' },
  { id: 'u27', nim: '2400022', nama: 'Umi Kalsum', email: 'umi.kalsum@example.com', role: 'praktikan' },
  { id: 'u28', nim: '2400023', nama: 'Vino Saputra', email: 'vino.saputra@example.com', role: 'praktikan' },
  { id: 'u29', nim: '2400024', nama: 'Wulan Sari', email: 'wulan.sari@example.com', role: 'praktikan' },
  { id: 'u30', nim: '2400025', nama: 'Yoga Pramana', email: 'yoga.pramana@example.com', role: 'praktikan' },
  { id: 'u31', nim: '2400026', nama: 'Zaki Mubarak', email: 'zaki.mubarak@example.com', role: 'praktikan' },
  { id: 'u32', nim: '2400027', nama: 'Ayu Lestari', email: 'ayu.lestari@example.com', role: 'praktikan' },
  { id: 'u33', nim: '2400028', nama: 'Bagas Prakoso', email: 'bagas.prakoso@example.com', role: 'praktikan' },
  { id: 'u34', nim: '2400029', nama: 'Cindy Natalia', email: 'cindy.natalia@example.com', role: 'praktikan' },
  { id: 'u35', nim: '2400030', nama: 'Daffa Alfarizi', email: 'daffa.alfarizi@example.com', role: 'praktikan' },
  { id: 'u36', nim: '2400031', nama: 'Elsa Ramadhani', email: 'elsa.ramadhani@example.com', role: 'praktikan' },
];

// Turunan dari PENGGUNA (urutan tetap): ASISTEN[0] = Raka, PRAKTIKAN[0] = Andi (pengguna awal).
export const ASISTEN = PENGGUNA.filter((u): u is Asisten => u.role === 'asisten');
export const PRAKTIKAN = PENGGUNA.filter((u): u is Praktikan => u.role === 'praktikan');

// ---------- relasi N:M: praktikan terdaftar di kelas ----------
// Satu praktikan bisa di beberapa kelas (contoh: u6 di PPK-A dan Basis Data-A).
export const PENDAFTARAN: Pendaftaran[] = [
  { id: 'pd1', userId: 'u6', kelasId: 'k1' },
  { id: 'pd2', userId: 'u7', kelasId: 'k1' },
  { id: 'pd3', userId: 'u8', kelasId: 'k1' },
  { id: 'pd4', userId: 'u9', kelasId: 'k1' },
  { id: 'pd5', userId: 'u10', kelasId: 'k1' },
  { id: 'pd6', userId: 'u11', kelasId: 'k2' },
  { id: 'pd7', userId: 'u12', kelasId: 'k2' },
  { id: 'pd8', userId: 'u13', kelasId: 'k2' },
  { id: 'pd9', userId: 'u14', kelasId: 'k2' },
  { id: 'pd10', userId: 'u15', kelasId: 'k3' },
  { id: 'pd11', userId: 'u16', kelasId: 'k3' },
  { id: 'pd12', userId: 'u6', kelasId: 'k4' },
  { id: 'pd13', userId: 'u7', kelasId: 'k4' },
  { id: 'pd14', userId: 'u8', kelasId: 'k4' },
  { id: 'pd15', userId: 'u9', kelasId: 'k4' },
  { id: 'pd16', userId: 'u11', kelasId: 'k5' },
  { id: 'pd17', userId: 'u12', kelasId: 'k5' },
  { id: 'pd18', userId: 'u13', kelasId: 'k5' },
  { id: 'pd19', userId: 'u14', kelasId: 'k5' },
  { id: 'pd20', userId: 'u17', kelasId: 'k1' },
  { id: 'pd21', userId: 'u18', kelasId: 'k1' },
  { id: 'pd22', userId: 'u19', kelasId: 'k1' },
  { id: 'pd23', userId: 'u20', kelasId: 'k1' },
  { id: 'pd24', userId: 'u21', kelasId: 'k1' },
  { id: 'pd25', userId: 'u22', kelasId: 'k1' },
  { id: 'pd26', userId: 'u23', kelasId: 'k1' },
  { id: 'pd27', userId: 'u24', kelasId: 'k1' },
  { id: 'pd28', userId: 'u25', kelasId: 'k1' },
  { id: 'pd29', userId: 'u26', kelasId: 'k1' },
  { id: 'pd30', userId: 'u27', kelasId: 'k1' },
  { id: 'pd31', userId: 'u28', kelasId: 'k1' },
  { id: 'pd32', userId: 'u29', kelasId: 'k1' },
  { id: 'pd33', userId: 'u30', kelasId: 'k1' },
  { id: 'pd34', userId: 'u31', kelasId: 'k1' },
  { id: 'pd35', userId: 'u32', kelasId: 'k1' },
  { id: 'pd36', userId: 'u33', kelasId: 'k1' },
  { id: 'pd37', userId: 'u34', kelasId: 'k1' },
  { id: 'pd38', userId: 'u35', kelasId: 'k1' },
  { id: 'pd39', userId: 'u36', kelasId: 'k1' },
  // Tahun ajaran lalu (kelas k6/k7).
  { id: 'pd40', userId: 'u6', kelasId: 'k6' },
  { id: 'pd41', userId: 'u7', kelasId: 'k6' },
  { id: 'pd42', userId: 'u6', kelasId: 'k7' },
];

// ---------- relasi N:M: asisten ditugaskan di kelas ----------
// Satu kelas bisa punya >1 asisten (k1: u1 dan u4), satu asisten bisa di >1 kelas (u4: k1 dan k5).
export const PENUGASAN: Penugasan[] = [
  { id: 'pt1', userId: 'u1', kelasId: 'k1' },
  { id: 'pt2', userId: 'u4', kelasId: 'k1' },
  { id: 'pt3', userId: 'u2', kelasId: 'k2' },
  { id: 'pt4', userId: 'u5', kelasId: 'k3' },
  { id: 'pt5', userId: 'u3', kelasId: 'k4' },
  { id: 'pt6', userId: 'u4', kelasId: 'k5' },
  { id: 'pt7', userId: 'u1', kelasId: 'k6' }, // tahun ajaran lalu
  { id: 'pt8', userId: 'u3', kelasId: 'k7' }, // tahun ajaran lalu
];

// ---------- sesi ----------
// 12 sesi (closedAt sengaja bervariasi, tidak selalu sama dengan endAt). Hanya data mentah: nama praktikum, kelas, ruangan, dan nama asisten dihitung di
// AppContext lewat ID. Asisten hanya melihat/mengelola sesi dengan asistenId miliknya.
// Skenario uji:
//  - s2  (PPK-A, dibuka) : presensi bisa langsung dites; belum ada presensi -> empty state rekap
//  - s7  (PPK-B, dibuka) : sesi dibuka kedua, sudah ada 2 presensi
//  - s3-s5, s8, s10, s12 : belum_dibuka -> tombol presensi nonaktif, tombol 'Buka sesi' aktif
//  - s1, s6, s9, s11     : ditutup -> riwayat & rekap berisi
export const INITIAL_SESSIONS: SessionData[] = [
  { id: 's1', kelasId: 'k1', modulId: 'm1', ruanganId: 'r1', asistenId: 'u1',
    startAt: '2026-10-17T08:00:00.000+07:00', endAt: '2026-10-17T10:00:00.000+07:00', status: 'ditutup', openedAt: '2026-10-17T08:02:00.000+07:00', closedAt: '2026-10-17T10:07:00.000+07:00' },
  { id: 's2', kelasId: 'k1', modulId: 'm2', ruanganId: 'r1', asistenId: 'u1',
    startAt: '2026-10-24T08:00:00.000+07:00', endAt: '2026-10-24T10:00:00.000+07:00', status: 'dibuka', openedAt: '2026-10-24T08:01:00.000+07:00' },
  { id: 's3', kelasId: 'k1', modulId: 'm3', ruanganId: 'r1', asistenId: 'u1',
    startAt: '2026-10-31T08:00:00.000+07:00', endAt: '2026-10-31T10:00:00.000+07:00', status: 'belum_dibuka' },
  { id: 's4', kelasId: 'k1', modulId: 'm4', ruanganId: 'r2', asistenId: 'u1',
    startAt: '2026-11-07T08:00:00.000+07:00', endAt: '2026-11-07T10:00:00.000+07:00', status: 'belum_dibuka' },
  { id: 's5', kelasId: 'k1', modulId: 'm5', ruanganId: 'r2', asistenId: 'u4',
    startAt: '2026-11-14T08:00:00.000+07:00', endAt: '2026-11-14T10:00:00.000+07:00', status: 'belum_dibuka' },
  { id: 's6', kelasId: 'k2', modulId: 'm1', ruanganId: 'r3', asistenId: 'u2',
    startAt: '2026-10-17T13:00:00.000+07:00', endAt: '2026-10-17T15:00:00.000+07:00', status: 'ditutup', openedAt: '2026-10-17T13:01:00.000+07:00', closedAt: '2026-10-17T14:56:00.000+07:00' },
  { id: 's7', kelasId: 'k2', modulId: 'm2', ruanganId: 'r3', asistenId: 'u2',
    startAt: '2026-10-24T13:00:00.000+07:00', endAt: '2026-10-24T15:00:00.000+07:00', status: 'dibuka', openedAt: '2026-10-24T13:02:00.000+07:00' },
  { id: 's8', kelasId: 'k2', modulId: 'm3', ruanganId: 'r3', asistenId: 'u2',
    startAt: '2026-10-31T13:00:00.000+07:00', endAt: '2026-10-31T15:00:00.000+07:00', status: 'belum_dibuka' },
  { id: 's9', kelasId: 'k4', modulId: 'm6', ruanganId: 'r4', asistenId: 'u3',
    startAt: '2026-10-20T10:00:00.000+07:00', endAt: '2026-10-20T12:00:00.000+07:00', status: 'ditutup', openedAt: '2026-10-20T10:01:00.000+07:00', closedAt: '2026-10-20T12:05:00.000+07:00' },
  { id: 's10', kelasId: 'k4', modulId: 'm7', ruanganId: 'r4', asistenId: 'u3',
    startAt: '2026-10-27T10:00:00.000+07:00', endAt: '2026-10-27T12:00:00.000+07:00', status: 'belum_dibuka' },
  { id: 's11', kelasId: 'k5', modulId: 'm6', ruanganId: 'r4', asistenId: 'u4',
    startAt: '2026-10-21T13:00:00.000+07:00', endAt: '2026-10-21T15:00:00.000+07:00', status: 'ditutup', openedAt: '2026-10-21T13:01:00.000+07:00', closedAt: '2026-10-21T15:03:00.000+07:00' },
  { id: 's12', kelasId: 'k5', modulId: 'm7', ruanganId: 'r4', asistenId: 'u4',
    startAt: '2026-10-28T13:00:00.000+07:00', endAt: '2026-10-28T15:00:00.000+07:00', status: 'belum_dibuka' },
];

// ---------- presensi ----------
// Maksimal 1 baris per (sesi, praktikan) dan hanya dari praktikan yang terdaftar di kelas sesi itu.
// Waktu hadir berada di antara openedAt dan closedAt sesi. id = att-<sesi>-<pengguna>.
export const INITIAL_ATTENDANCES: Attendance[] = [
  { id: 'att-s1-u6', sessionId: 's1', userId: 'u6', waktuHadir: '2026-10-17T08:05:12.000+07:00' },
  { id: 'att-s1-u8', sessionId: 's1', userId: 'u8', waktuHadir: '2026-10-17T08:09:40.000+07:00' },
  { id: 'att-s1-u10', sessionId: 's1', userId: 'u10', waktuHadir: '2026-10-17T08:12:03.000+07:00' },
  { id: 'att-s1-u17', sessionId: 's1', userId: 'u17', waktuHadir: '2026-10-17T08:15:11.000+07:00' },
  { id: 'att-s1-u18', sessionId: 's1', userId: 'u18', waktuHadir: '2026-10-17T08:16:00.000+07:00' },
  { id: 'att-s1-u20', sessionId: 's1', userId: 'u20', waktuHadir: '2026-10-17T08:17:20.000+07:00' },
  { id: 'att-s1-u21', sessionId: 's1', userId: 'u21', waktuHadir: '2026-10-17T08:19:13.000+07:00' },
  { id: 'att-s1-u22', sessionId: 's1', userId: 'u22', waktuHadir: '2026-10-17T08:19:49.000+07:00' },
  { id: 'att-s1-u23', sessionId: 's1', userId: 'u23', waktuHadir: '2026-10-17T08:20:28.000+07:00' },
  { id: 'att-s1-u24', sessionId: 's1', userId: 'u24', waktuHadir: '2026-10-17T08:22:43.000+07:00' },
  { id: 'att-s1-u25', sessionId: 's1', userId: 'u25', waktuHadir: '2026-10-17T08:24:21.000+07:00' },
  { id: 'att-s1-u26', sessionId: 's1', userId: 'u26', waktuHadir: '2026-10-17T08:25:03.000+07:00' },
  { id: 'att-s1-u28', sessionId: 's1', userId: 'u28', waktuHadir: '2026-10-17T08:26:19.000+07:00' },
  { id: 'att-s1-u29', sessionId: 's1', userId: 'u29', waktuHadir: '2026-10-17T08:28:03.000+07:00' },
  { id: 'att-s1-u30', sessionId: 's1', userId: 'u30', waktuHadir: '2026-10-17T08:28:40.000+07:00' },
  { id: 'att-s1-u32', sessionId: 's1', userId: 'u32', waktuHadir: '2026-10-17T08:31:06.000+07:00' },
  { id: 'att-s1-u33', sessionId: 's1', userId: 'u33', waktuHadir: '2026-10-17T08:32:40.000+07:00' },
  { id: 'att-s1-u34', sessionId: 's1', userId: 'u34', waktuHadir: '2026-10-17T08:33:37.000+07:00' },
  { id: 'att-s1-u36', sessionId: 's1', userId: 'u36', waktuHadir: '2026-10-17T08:34:11.000+07:00' },
  { id: 'att-s6-u11', sessionId: 's6', userId: 'u11', waktuHadir: '2026-10-17T13:03:27.000+07:00' },
  { id: 'att-s6-u12', sessionId: 's6', userId: 'u12', waktuHadir: '2026-10-17T13:06:51.000+07:00' },
  { id: 'att-s6-u13', sessionId: 's6', userId: 'u13', waktuHadir: '2026-10-17T13:14:09.000+07:00' },
  { id: 'att-s6-u14', sessionId: 's6', userId: 'u14', waktuHadir: '2026-10-17T13:21:35.000+07:00' },
  { id: 'att-s9-u6', sessionId: 's9', userId: 'u6', waktuHadir: '2026-10-20T10:02:44.000+07:00' },
  { id: 'att-s9-u7', sessionId: 's9', userId: 'u7', waktuHadir: '2026-10-20T10:07:18.000+07:00' },
  { id: 'att-s9-u8', sessionId: 's9', userId: 'u8', waktuHadir: '2026-10-20T10:11:56.000+07:00' },
  { id: 'att-s11-u11', sessionId: 's11', userId: 'u11', waktuHadir: '2026-10-21T13:01:38.000+07:00' },
  { id: 'att-s11-u12', sessionId: 's11', userId: 'u12', waktuHadir: '2026-10-21T13:05:02.000+07:00' },
  { id: 'att-s11-u14', sessionId: 's11', userId: 'u14', waktuHadir: '2026-10-21T13:09:47.000+07:00' },
  { id: 'att-s7-u11', sessionId: 's7', userId: 'u11', waktuHadir: '2026-10-24T13:04:10.000+07:00' },
  { id: 'att-s7-u14', sessionId: 's7', userId: 'u14', waktuHadir: '2026-10-24T13:08:33.000+07:00' },
  // s1 (PPK-A, 25 praktikan) berisi 19 hadir + 6 tidak hadir -> tes daftar panjang.
// s2 (dibuka, PPK-A) sengaja kosong -> tes empty state rekap
];
