export const STATUS_SESI = {
  BELUM: "belum_dibuka",
  DIBUKA: "dibuka",
  DITUTUP: "ditutup",
} as const;

export const STATUS_IZIN = {
  MENUNGGU: "menunggu",
  DITERIMA: "diterima",
  DITOLAK: "ditolak",
} as const;

export type StatusSesi = (typeof STATUS_SESI)[keyof typeof STATUS_SESI];
export type StatusIzin = (typeof STATUS_IZIN)[keyof typeof STATUS_IZIN];
export type Role = "asisten" | "praktikan";

// Kelas praktikum yang tersedia (evaluasi Sprint 2: Kelas A–E).
export const KODE_KELAS = ["A", "B", "C", "D", "E"] as const;
export type KodeKelas = (typeof KODE_KELAS)[number];

// Maksimal asisten pengampu per kelas (pembuat + satu partner).
export const MAKS_ASISTEN_KELAS = 2;

// Slot waktu tetap: setiap sesi tepat 2 jam (jam WIB). Sama dengan daftar di firestore.rules.
export const SLOT_WAKTU = [
  { slot: 1, mulai: "07:00", selesai: "09:00" },
  { slot: 2, mulai: "09:00", selesai: "11:00" },
  { slot: 3, mulai: "11:00", selesai: "13:00" },
  { slot: 4, mulai: "13:00", selesai: "15:00" },
  { slot: 5, mulai: "15:00", selesai: "17:00" },
] as const;
export type SlotWaktu = (typeof SLOT_WAKTU)[number];
