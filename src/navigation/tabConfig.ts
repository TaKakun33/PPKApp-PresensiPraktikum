// FILE AKMAL (feat/auth-leave-ai) — SRS-12. Daftar tab per peran.
// Menambah tab baru = tambah satu entri di sini + satu file route di src/app/<peran>/<name>.tsx.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type TabDef = { name: string; title: string; icon: IoniconsName };

export const PRAKTIKAN_TABS: TabDef[] = [
  { name: 'home', title: 'Home', icon: 'home-outline' },
  { name: 'jadwal', title: 'Jadwal', icon: 'calendar-outline' },
  { name: 'presensi', title: 'Presensi', icon: 'checkbox-outline' },
  { name: 'izin', title: 'Izin', icon: 'document-text-outline' },
  { name: 'riwayat', title: 'Riwayat', icon: 'time-outline' },
];

export const ASISTEN_TABS: TabDef[] = [
  { name: 'jadwal', title: 'Jadwal', icon: 'calendar-outline' },
  { name: 'kelola', title: 'Kelola Sesi', icon: 'settings-outline' },
  { name: 'rekap', title: 'Rekap', icon: 'list-outline' },
  { name: 'izin', title: 'Izin', icon: 'document-text-outline' },
];
