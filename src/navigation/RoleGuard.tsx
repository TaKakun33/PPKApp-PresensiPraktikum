// FILE AKMAL (feat/auth-leave-ai) — SRS-12.
// Penjaga navigasi: belum login → /login; peran tidak cocok → dialihkan ke beranda perannya sendiri.
// `role` boleh dikosongkan untuk layar yang terbuka bagi kedua peran (mis. detail sesi): hanya cek login.
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import type { Role } from '../lib/constants';
import { useAuth } from '../context/AuthContext';
import AuthLoadingGate from './AuthLoadingGate';

export default function RoleGuard({ role, children }: { role?: Role; children: ReactNode }) {
  const { state } = useAuth();

  if (state.status === 'loading') return <AuthLoadingGate />;
  if (state.status === 'unauthenticated') return <Redirect href="/login" />;

  if (role && state.profile.role !== role) {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
  }

  return <>{children}</>;
}
