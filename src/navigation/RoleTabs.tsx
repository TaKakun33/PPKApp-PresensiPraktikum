// FILE AKMAL (feat/auth-leave-ai) — SRS-12. Bottom Tab bersama untuk kedua peran (tampilan sama
// seperti layout Sprint 1), isi tab ditentukan oleh daftar TabDef.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import LogoutButton from './LogoutButton';
import type { TabDef } from './tabConfig';

export default function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 24);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.mutedLight,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.surface,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 2 },
        headerStyle: { backgroundColor: COLORS.card },
        headerTitleStyle: { color: COLORS.text, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => <LogoutButton />,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
