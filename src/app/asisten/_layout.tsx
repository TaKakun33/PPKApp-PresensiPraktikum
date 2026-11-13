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
      <Ionicons name="swap-horizontal" size={14} color={COLORS.text} />
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  btnPressed: {
    backgroundColor: COLORS.border,
    opacity: 0.85,
  },
  text: {
    color: COLORS.text,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
});

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICON: Record<string, IoniconsName> = {
  jadwal: 'calendar-outline',
  kelola: 'settings-outline',
  rekap: 'list-outline',
  izin: 'document-text-outline',
};
// Layout tab asisten (SRS-12, Akmal). Isi navigasi ada di src/navigation/.
import RoleGuard from '../../navigation/RoleGuard';
import RoleTabs from '../../navigation/RoleTabs';
import { ASISTEN_TABS } from '../../navigation/tabConfig';

export default function AsistenLayout() {
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          marginTop: 2,
        },
        headerStyle: { backgroundColor: COLORS.card },
        headerTitleStyle: {
          color: COLORS.text,
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
      <Tabs.Screen
        name="izin"
        options={{
          title: 'Izin',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.izin} size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
    <RoleGuard role="asisten">
      <RoleTabs tabs={ASISTEN_TABS} />
    </RoleGuard>
  );
}
