// FILE MILIK PM - warna bersama supaya tampilan konsisten.
import type { SessionStatus } from '../data/types';

export const COLORS = {
  primary: '#2563EB',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
};

// Status disimpan sebagai kode; tampilkan ke pengguna lewat STATUS_LABEL.
export const STATUS_LABEL: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export const STATUS_COLORS: Record<SessionStatus, { bg: string; text: string }> = {
  belum_dibuka: { bg: '#E2E8F0', text: '#475569' },
  dibuka: { bg: '#DCFCE7', text: '#166534' },
  ditutup: { bg: '#FEE2E2', text: '#991B1B' },
};
