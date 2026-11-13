// FILE AKMAL (feat/auth-leave-ai) — SRS-12. Daftar tab per peran.
// Menambah tab baru = tambah satu entri di sini + satu file route di src/app/<peran>/<name>.tsx.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type TabDef = { name: string; title: string; icon: IoniconsName };

export const PRAKTIKAN_TABS: TabDef[] = [
  { name: 'jadwal', title: 'Jadwal', icon: 'calendar-outline' },
  { name: 'presensi', title: 'Presensi', icon: 'checkbox-outline' },
  { name: 'izin', title: 'Izin', icon: 'document-text-outline' },
  { name: 'riwayat', title: 'Riwayat', icon: 'time-outline' },
];

// TODO setelah branch Naufal (LeaveReviewScreen) dan Hadrian (ManageClassScreen) dimerge:
//   tambahkan { name: 'izin', title: 'Izin', icon: 'document-text-outline' } dan
//   { name: 'kelas', title: 'Kelas', icon: 'people-outline' }, lalu buat file route-nya
//   (src/app/asisten/izin.tsx dan src/app/asisten/kelas.tsx) yang me-re-export layar masing-masing.
export const ASISTEN_TABS: TabDef[] = [
  { name: 'jadwal', title: 'Jadwal', icon: 'calendar-outline' },
  { name: 'kelola', title: 'Kelola Sesi', icon: 'settings-outline' },
  { name: 'rekap', title: 'Rekap', icon: 'list-outline' },
];
