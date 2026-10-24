// STUB dari PM - pemilik: Zhafran (feat/role-navigation), SRS-02.
// Bottom Tab untuk peran asisten. TODO: ikon tab, tombol "Ganti peran" di header.
// Ikon tab dari @expo/vector-icons, tombol "Ganti Peran" di header kanan.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/colors';

function GantiPeranButton() {
  return (
    <Pressable
      onPress={() => router.replace('/')}
      style={({ pressed }) => [btnStyles.btn, pressed && btnStyles.btnPressed]}
      accessibilityRole="button"
      accessibilityLabel="Ganti Peran"
    >
      <Ionicons name="swap-horizontal" size={14} color="#0F172A" />
      <Text style={btnStyles.text}>Ganti Peran</Text>
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  btnPressed: {
    backgroundColor: '#E2E8F0',
    opacity: 0.85,
  },
  text: {
    color: '#0F172A',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
});

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICON: Record<string, IoniconsName> = {
  jadwal: 'calendar-outline',
  kelola: 'settings-outline',
  rekap: 'list-outline',
};

export default function AsistenLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 24);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          marginTop: 2,
        },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: {
          color: '#0F172A',
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 17,
        },
        headerShadowVisible: false,
        headerRight: () => <GantiPeranButton />,
      }}
    >
      <Tabs.Screen
        name="jadwal"
        options={{
          title: 'Jadwal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.jadwal} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="kelola"
        options={{
          title: 'Kelola Sesi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.kelola} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="rekap"
        options={{
          title: 'Rekap',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.rekap} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
