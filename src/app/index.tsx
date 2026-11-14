// FILE MILIK PM — gate utama: cek auth → redirect ke layar yang tepat.
// Belum login → /login | login sebagai praktikan → /praktikan/home | asisten → /asisten/jadwal
import { Redirect } from 'expo-router';

import { useAuth } from '../context/AuthContext';
import AuthLoadingGate from '../navigation/AuthLoadingGate';

export default function IndexScreen() {
  const { state } = useAuth();

  if (state.status === 'loading') return <AuthLoadingGate />;
  if (state.status === 'unauthenticated') return <Redirect href="/login" />;

  const role = state.profile.role;
  return <Redirect href={role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
}
