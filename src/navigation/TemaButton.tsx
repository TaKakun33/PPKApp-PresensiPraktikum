// Tombol di header: membuka pemilih tampilan (mode terang/gelap + tema warna).
// Menggantikan ikon profil; profil sekarang dibuka dengan mengetuk avatar.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import PemilihTema from '../components/PemilihTema';
import { colors, isDark, radius } from '../constants/theme';

export default function TemaButton() {
  const [terbuka, setTerbuka] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setTerbuka(true)}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Ganti tema dan mode gelap"
      >
        <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={18} color={colors.text} />
      </Pressable>
      <PemilihTema visible={terbuka} onClose={() => setTerbuka(false)} />
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
