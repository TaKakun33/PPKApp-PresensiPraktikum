// FILE AKMAL (feat/auth-leave-ai) — SRS-12.
// Tampilan selama status auth "loading". Jika profil tak kunjung terbaca (mis. offline) tampil pesan
// dengan tombol "Coba lagi" dan "Keluar", alih-alih memaksa pengguna logout.
import { Alert, Button, View } from 'react-native';

import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

export default function AuthLoadingGate({ message = 'Memeriksa sesi login...' }: { message?: string }) {
  const { profileError, retryProfile, signOut } = useAuth();

  if (!profileError) return <LoadingState message={message} />;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('Gagal keluar', 'Tidak dapat keluar dari akun. Coba lagi.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ErrorState message={profileError} onRetry={retryProfile} />
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Button title="Keluar dari akun" color={COLORS.danger} onPress={handleSignOut} />
      </View>
    </View>
  );
}
