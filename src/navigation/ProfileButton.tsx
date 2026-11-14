// Tombol di header tab: membuka layar Profil (lihat data akun, ubah nama, ubah password).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants/colors';

export default function ProfileButton() {
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      accessibilityRole="button"
      accessibilityLabel="Buka profil"
    >
      <Ionicons name="person-outline" size={14} color={COLORS.text} />
      <Text style={styles.text}>Profil</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
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
