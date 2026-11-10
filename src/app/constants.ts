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