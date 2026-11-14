// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Menggantikan tombol "Ganti Peran" (sisa Sprint 1).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import ConfirmModal from '../components/ConfirmModal';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function LogoutButton() {
  const { signOut, profile } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleConfirm = async () => {
    setConfirmVisible(false);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      Alert.alert('Gagal keluar', 'Tidak dapat keluar dari akun. Periksa koneksi lalu coba lagi.');
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setConfirmVisible(true)}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Keluar dari akun"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.primary} />
      </Pressable>
      <ConfirmModal
        visible={confirmVisible}
        title="Keluar dari akun?"
        message={`Kamu akan keluar${profile ? ` dari akun ${profile.nama}` : ''}. Data tetap tersimpan dan bisa diakses lagi setelah login.`}
        confirmLabel="Keluar"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.icon,
    backgroundColor: colors.surface,
  },
  btnPressed: { backgroundColor: colors.tint, opacity: 0.9 },
});
