// STUB dari PM - pemilik: Zhafran (feat/role-navigation), SRS-01.
// TODO: form pilih peran + identitas (chip), tombol "Lanjut" nonaktif + pesan validasi
//       jika belum lengkap. Data pilihan: ASISTEN dan PRAKTIKAN dari ../data/dummy.
// Stub ini hanya dua tombol pintas supaya anggota lain bisa mengetes layarnya.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { ASISTEN, PRAKTIKAN } from '../data/dummy';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { setCurrentUser } = useApp();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoleSelectScreen (stub)</Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          setCurrentUser(PRAKTIKAN[0]);
          router.replace('/praktikan/jadwal');
        }}
      >
        <Text style={styles.buttonText}>Masuk sebagai Praktikan (Andi, kelas A)</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => {
          setCurrentUser(ASISTEN[0]);
          router.replace('/asisten/jadwal');
        }}
      >
        <Text style={styles.buttonText}>Masuk sebagai Asisten (Kak Raka, kelas A)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: COLORS.background },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  button: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center' },
});
