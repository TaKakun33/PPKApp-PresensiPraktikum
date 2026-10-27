// FILE MILIK PM - warna bersama supaya tampilan konsisten.
import type { SessionStatus } from '../data/types';

export const COLORS = {
  // Core palette
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryBorder: '#DBEAFE',

  // Backgrounds
  background: '#F8FAFC',
  card: '#FFFFFF',
  white: '#FFFFFF',
  surface: '#F1F5F9',

  // Text
  text: '#0F172A',
  textSecondary: '#475569',
  muted: '#64748B',
  mutedLight: '#94A3B8',

  // Borders
  border: '#E2E8F0',
  borderLight: '#CBD5E1',

  // Interactive
  pressed: '#1E293B',

  // Semantic
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FEE2E2',
  warning: '#D97706',
};

// Status disimpan sebagai kode; tampilkan ke pengguna lewat STATUS_LABEL.
export const STATUS_LABEL: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export const STATUS_COLORS: Record<SessionStatus, { bg: string; text: string }> = {
  belum_dibuka: { bg: '#FEF3C7', text: '#92400E' },
  dibuka: { bg: '#DCFCE7', text: '#166534' },
  ditutup: { bg: '#F1F5F9', text: '#64748B' },
};
