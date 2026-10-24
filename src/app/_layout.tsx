// FILE MILIK PM - root layout + provider state bersama.
import { Stack } from 'expo-router';

import { AppProvider } from '../context/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="praktikan" />
        <Stack.Screen name="asisten" />
        <Stack.Screen name="session/[id]" options={{ headerShown: true, title: 'Detail Sesi' }} />
      </Stack>
    </AppProvider>
  );
}
