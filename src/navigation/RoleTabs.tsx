// FILE AKMAL (feat/auth-leave-ai) — SRS-12. Bottom Tab bersama untuk kedua peran (tampilan sama
// seperti layout Sprint 1), isi tab ditentukan oleh daftar TabDef.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import FloatingTabBar from '../components/FloatingTabBar';
import type { TabDef } from './tabConfig';

export default function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
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
