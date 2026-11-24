// FILE MILIK PM - root layout + provider state bersama.
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { colors, font } from '../constants/theme';
import { AuthProvider, useAuth } from '../context/AuthContext';
// Zhafran (feat/push-notif, SRS-34, 36): hook registrasi token & navigasi notifikasi.
import { useNotifikasi } from '../hooks/useNotifikasi';

SplashScreen.preventAutoHideAsync();

// Komponen terpisah agar hook dapat mengakses AuthContext yang sudah terpasang.
// Dipasang di dalam <AuthProvider> sehingga useAuth() selalu tersedia.
// Zhafran (feat/push-notif, SRS-34, 36)
function NotifikasiSetup() {
  const { profile } = useAuth();
  useNotifikasi(profile);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <NotifikasiSetup />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontFamily: font.bold, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="praktikan" />
        <Stack.Screen name="asisten" />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profil' }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: true, title: 'Detail Sesi' }} />
      </Stack>
    </AuthProvider>
  );
}
