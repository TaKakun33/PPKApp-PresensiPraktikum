// FILE MILIK PM — gate utama: cek auth → redirect ke layar yang tepat.
// Belum login → /login | login sebagai praktikan → /praktikan/jadwal | asisten → /asisten/jadwal
import { Redirect } from 'expo-router';

import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';

export default function IndexScreen() {
  const { state } = useAuth();

  if (state.status === 'loading') return <LoadingState message="Memeriksa sesi login..." />;
  if (state.status === 'unauthenticated') return <Redirect href="/login" />;

  const role = state.profile.role;
  return <Redirect href={role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
}
