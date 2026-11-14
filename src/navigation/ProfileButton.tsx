// Tombol di header: membuka layar Profil (lihat data akun, ubah nama, ubah password).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '../constants/theme';

export default function ProfileButton() {
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      accessibilityRole="button"
      accessibilityLabel="Buka profil"
    >
      <Ionicons name="person-outline" size={18} color={colors.primary} />
    </Pressable>
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
