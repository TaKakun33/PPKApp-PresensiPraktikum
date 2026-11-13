// FILE MILIK PM - warna bersama supaya tampilan konsisten.
import type { SessionStatus } from '../data/types';

export const COLORS = {
  // Core palette
  primary: '#007AFF',
  primaryLight: '#E8F2FF',
  primaryBorder: '#CFE5FF',

  // Backgrounds
  background: '#F5F5F7',
  card: '#FFFFFF',
  white: '#FFFFFF',
  surface: '#F5F5F7',

  // Text
  text: '#1D1D1F',
  textSecondary: '#4A4A4F',
  muted: '#AAAAAA',
  mutedLight: '#AAAAAA',

  // Borders
  border: '#E5E5EA',
  borderLight: '#D1D1D6',

  // Interactive
  pressed: '#1D1D1F',

  // Semantic
  success: '#34C759',
  successLight: '#E9F9EE',
  danger: '#FF3B30',
  dangerLight: '#FFF0EF',
  dangerBorder: '#FFD9D6',
  warning: '#FF9500',
};

// Status disimpan sebagai kode; tampilkan ke pengguna lewat STATUS_LABEL.
export const STATUS_LABEL: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export const STATUS_COLORS: Record<SessionStatus, { bg: string; text: string }> = {
  belum_dibuka: { bg: '#F5F5F7', text: '#6B6B70' },
  dibuka: { bg: '#E8F2FF', text: '#007AFF' },
  ditutup: { bg: '#F5F5F7', text: '#AAAAAA' },
};
