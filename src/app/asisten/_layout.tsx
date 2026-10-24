// STUB dari PM - pemilik: Zhafran (feat/role-navigation), SRS-02.
// Bottom Tab untuk peran asisten. TODO: ikon tab, tombol "Ganti peran" di header.
import { Tabs } from 'expo-router';

export default function AsistenLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="jadwal" options={{ title: 'Jadwal' }} />
      <Tabs.Screen name="kelola" options={{ title: 'Kelola Sesi' }} />
      <Tabs.Screen name="rekap" options={{ title: 'Rekap' }} />
    </Tabs>
  );
}
