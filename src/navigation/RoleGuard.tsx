// FILE AKMAL (feat/auth-leave-ai) — SRS-12.
// Penjaga navigasi: belum login → /login; peran tidak cocok → dialihkan ke beranda perannya sendiri.
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import LoadingState from '../components/LoadingState';
import type { Role } from '../app/constants';
import { useAuth } from '../context/AuthContext';

export default function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const { state } = useAuth();

  if (state.status === 'loading') return <LoadingState message="Memeriksa sesi login..." />;
  if (state.status === 'unauthenticated') return <Redirect href="/login" />;

  if (state.profile.role !== role) {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/jadwal'} />;
  }

  return <>{children}</>;
}
