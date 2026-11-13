// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Menggantikan tombol "Ganti Peran" (sisa Sprint 1).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import ConfirmModal from '../components/ConfirmModal';
import { COLORS } from '../constants/colors';
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
        <Ionicons name="log-out-outline" size={14} color={COLORS.text} />
        <Text style={styles.text}>Keluar</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  btnPressed: { backgroundColor: COLORS.border, opacity: 0.85 },
  text: { color: COLORS.text, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
});
