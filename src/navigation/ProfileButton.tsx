// Avatar di header: diketuk untuk membuka layar Profil (lihat data akun, ubah nama, ubah password).
// Menggantikan ikon orang; ikon itu kini dipakai tombol tema (TemaButton).
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

/** Huruf pertama nama (maks. 2 kata) untuk avatar. */
export function inisialNama(nama: string | null | undefined): string {
  const huruf = (nama ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? '')
    .join('');
  return huruf || '?';
}

type Props = { size?: number };

export default function ProfileButton({ size = 40 }: Props) {
  const { profile } = useAuth();
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [
        styles.avatar,
        { width: size, height: size, borderRadius: Math.round(size / 3) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Buka profil akun"
    >
      <Text style={[styles.teks, { fontSize: Math.round(size * 0.36) }]}>{inisialNama(profile?.nama)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  pressed: { opacity: 0.75 },
  teks: { fontFamily: font.extraBold, color: colors.secondaryText },
});
