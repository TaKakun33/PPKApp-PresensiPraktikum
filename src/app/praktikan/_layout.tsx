// STUB dari PM - pemilik: Zhafran (feat/role-navigation), SRS-02.
// Bottom Tab untuk peran praktikan. TODO: ikon tab, tombol "Ganti peran" di header.
import { Tabs } from 'expo-router';

export default function PraktikanLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="jadwal" options={{ title: 'Jadwal' }} />
      <Tabs.Screen name="presensi" options={{ title: 'Presensi' }} />
      <Tabs.Screen name="riwayat" options={{ title: 'Riwayat' }} />
    </Tabs>
  );
}
