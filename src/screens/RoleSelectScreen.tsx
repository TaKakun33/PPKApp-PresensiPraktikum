// STUB dari PM - pemilik: Zhafran (feat/role-navigation), SRS-01.
// TODO: form pilih peran + identitas (chip), tombol "Lanjut" nonaktif + pesan validasi
//       jika belum lengkap. Data pilihan: ASISTEN dan PRAKTIKAN dari ../data/dummy.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import {
  ASISTEN,
  KELAS,
  PENDAFTARAN,
  PENUGASAN,
  PRAKTIKAN,
  PRAKTIKUM,
  TAHUN_AJARAN,
} from '../data/dummy';
import type { Role, User } from '../data/types';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ROLE_CONFIG: Record<Role, { label: string; icon: IoniconsName; desc: string; badge: string }> = {
  praktikan: {
    label: 'Mahasiswa',
    icon: 'school-outline',
    desc: 'Akses jadwal, presensi sesi, dan pantau riwayat',
    badge: 'Praktikan',
  },
  asisten: {
    label: 'Asprak',
    icon: 'people-outline',
    desc: 'Buka/tutup sesi dan kelola rekap kehadiran',
    badge: 'Asisten Praktikum',
  },
};

// Daftar kelas aktif milik user, contoh: ['PPK A', 'BD A'].
// Praktikan -> dari PENDAFTARAN, asisten -> dari PENUGASAN. Hanya tahun ajaran aktif.
function getKelasLabels(user: User): string[] {
  const relasi = user.role === 'praktikan' ? PENDAFTARAN : PENUGASAN;
  const taAktifIds = TAHUN_AJARAN.filter((t) => t.isAktif).map((t) => t.id);

  return relasi
    .filter((r) => r.userId === user.id)
    .map((r) => KELAS.find((k) => k.id === r.kelasId))
    .filter((k): k is NonNullable<typeof k> => !!k && taAktifIds.includes(k.tahunAjaranId))
    .map((k) => {
      const kode = PRAKTIKUM.find((p) => p.id === k.praktikumId)?.kode ?? '';
      return `${kode} ${k.kode}`.trim();
    });
}

export default function RoleSelectScreen() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const router = useRouter();
  const { setCurrentUser } = useApp();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#0F172A" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const userList = selectedRole === 'asisten' ? ASISTEN
    : selectedRole === 'praktikan' ? PRAKTIKAN : [];
  const isFormValid = selectedRole !== null && selectedUser !== null;

  // Step saat ini: 1 = pilih peran, 2 = pilih identitas
  const currentStep = selectedRole === null ? 1 : 2;

  // Saat peran berganti, reset pilihan identitas
  const handleRoleSelect = (role: Role) => {
    if (role !== selectedRole) {
      setSelectedRole(role);
      setSelectedUser(null);
      setShowValidation(false);
    }
  };

  const handleLanjut = () => {
    if (!isFormValid) {
      setShowValidation(true);
      return;
    }
    setCurrentUser(selectedUser!);
    router.replace(selectedRole === 'praktikan' ? '/praktikan/jadwal' : '/asisten/jadwal');
  };

  // Pesan validasi
  const validationMessage = !selectedRole
    ? 'Pilih peranmu terlebih dahulu'
    : !selectedUser
    ? 'Pilih identitasmu dari daftar'
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* Konten yang bisa di-scroll */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Greeting Area (Mirip Screen 2 Referensi) */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <View style={styles.brandRow}>
              <Text style={styles.appName}>TrackLab</Text>
            </View>
            <Text style={styles.greetingTitle}>Halo, Selamat Datang! </Text>
            <Text style={styles.subtitle}>Sistem Presensi Praktikum Terpadu</Text>
          </View>
        </View>

        {/* Step Indicator Kapsul Modern */}
        <View style={styles.stepContainer}>
          <View style={[styles.stepPill, currentStep === 1 ? styles.stepPillActive : styles.stepPillDone]}>
            <Ionicons
              name={currentStep > 1 ? 'checkmark-circle' : 'radio-button-on'}
              size={14}
              color={currentStep === 1 ? '#FFFFFF' : '#16A34A'}
            />
            <Text style={[styles.stepPillText, currentStep === 1 ? styles.stepPillTextActive : styles.stepPillTextDone]}>
              1. Pilih Peran
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />

          <View style={[styles.stepPill, currentStep === 2 ? styles.stepPillActive : styles.stepPillInactive]}>
            <Ionicons
              name={selectedUser ? 'checkmark-circle' : 'radio-button-off'}
              size={14}
              color={currentStep === 2 ? '#FFFFFF' : '#94A3B8'}
            />
            <Text style={[styles.stepPillText, currentStep === 2 ? styles.stepPillTextActive : styles.stepPillTextInactive]}>
              2. Pilih Identitas
            </Text>
          </View>
        </View>

        {/* Step 1: Pilih Peran (Mirip Card & Pill di Referensi) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Silahkan Pilih Peran Kamu</Text>
            <Text style={styles.sectionSub}>Tentukan peran kamu untuk mengakses fitur yang sesuai</Text>
          </View>

          <View style={styles.roleRow}>
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(
              ([role, cfg]) => {
                const active = selectedRole === role;
                return (
                  <Pressable
                    key={role}
                    style={({ pressed }) => [
                      styles.roleCard,
                      active && styles.roleCardActive,
                      pressed && styles.roleCardPressed,
                    ]}
                    onPress={() => handleRoleSelect(role)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    {/* Top Row: Icon Container + Floating Checkmark */}
                    <View style={styles.roleCardTop}>
                      <View style={[styles.roleIconBox, active && styles.roleIconBoxActive]}>
                        <Ionicons
                          name={cfg.icon}
                          size={24}
                          color={active ? '#FFFFFF' : '#0F172A'}
                        />
                      </View>
                      {active && (
                        <View style={styles.activeCheckBadge}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    {/* Role Information */}
                    <View style={styles.roleCardBody}>
                      <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>
                        {cfg.label}
                      </Text>
                      <Text style={styles.roleDesc} numberOfLines={2}>
                        {cfg.desc}
                      </Text>
                    </View>

                    {/* Mini Role Pill */}
                    <View style={[styles.rolePillBadge, active && styles.rolePillBadgeActive]}>
                      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>
                        {cfg.badge}
                      </Text>
                    </View>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

        {/* Step 2: Pilih Identitas */}
        {selectedRole !== null && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Pilih Identitas</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{userList.length} orang</Text>
                </View>
              </View>
              <Text style={styles.sectionSub}>
                {selectedRole === 'praktikan'
                  ? 'Pilih namamu dari daftar mahasiswa kelas praktikum'
                  : 'Pilih namamu dari daftar asisten praktikum'}
              </Text>
            </View>

            <View style={styles.identityList}>
              {userList.map((user) => {
                const active = selectedUser?.id === user.id;
                const kelasLabels = getKelasLabels(user);
                return (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [
                      styles.identityCard,
                      active && styles.identityCardActive,
                      pressed && styles.identityCardPressed,
                    ]}
                    onPress={() => {
                      setSelectedUser(user);
                      setShowValidation(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    {/* Avatar Inisial Elegan */}
                    <View style={[styles.avatar, active && styles.avatarActive]}>
                      <Text style={[styles.avatarText, active && styles.avatarTextActive]}>
                        {user.nama.charAt(0)}
                      </Text>
                    </View>

                    {/* Info Pengguna */}
                    <View style={styles.identityInfo}>
                      <Text style={[styles.identityName, active && styles.identityNameActive]}>
                        {user.nama}
                      </Text>

                      {/* Pill Meta Chips (Mirip Chip Info di Screen 3 Referensi) */}
                      <View style={styles.chipRow}>
                        {user.role === 'praktikan' && (
                          <View style={[styles.infoChip, active && styles.infoChipActive]}>
                            <Ionicons name="card-outline" size={11} color={active ? '#0F172A' : '#64748B'} />
                            <Text style={[styles.infoChipText, active && styles.infoChipTextActive]}>
                              {user.nim}
                            </Text>
                          </View>
                        )}
                        {kelasLabels.length > 0 && (
                          <View style={[styles.infoChipAccent, active && styles.infoChipAccentActive]}>
                            {user.role === 'asisten' && (
                              <Ionicons name="layers-outline" size={11} color="#2563EB" />
                            )}
                            <Text style={styles.infoChipAccentText}>
                              Kelas {kelasLabels.join(', ')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Indikator Pilihan (Radio Kapsul Modern) */}
                    <View style={[styles.selectionCircle, active && styles.selectionCircleActive]}>
                      {active && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Sticky: Tombol Bergaya "Book Now" (Mirip Screen 3 Referensi) */}
      <View style={styles.footer}>
        {showValidation && !isFormValid && (
          <View style={styles.validationBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.validationText}>{validationMessage}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleLanjut}
          accessibilityRole="button"
          accessibilityLabel="Lanjut ke aplikasi"
        >
          <Text style={styles.buttonText}>
            Lanjut ke Aplikasi
          </Text>
          <View style={styles.buttonIconBox}>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="#FFFFFF"
            />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
  },


  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  headerTextGroup: {
    flex: 1,
    gap: 3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  appName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  appPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  appPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#2563EB',
  },
  greetingTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
  },


  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  stepPillActive: {
    backgroundColor: '#0F172A',
  },
  stepPillDone: {
    backgroundColor: '#F0FDF4',
  },
  stepPillInactive: {
    backgroundColor: 'transparent',
  },
  stepPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },
  stepPillTextDone: {
    color: '#16A34A',
  },
  stepPillTextInactive: {
    color: '#94A3B8',
  },

  // ── Section ──
  section: {
    gap: 14,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },


  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: 'space-between',
  },
  roleCardActive: {
    borderColor: '#0F172A',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  roleCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconBoxActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  activeCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardBody: {
    gap: 4,
  },
  roleLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  roleLabelActive: {
    color: '#0F172A',
  },
  roleDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748B',
    lineHeight: 17,
  },
  rolePillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rolePillBadgeActive: {
    backgroundColor: '#EFF6FF',
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  rolePillTextActive: {
    color: '#2563EB',
  },


  identityList: {
    gap: 10,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  identityCardActive: {
    borderColor: '#0F172A',
    backgroundColor: '#FAFAFA',
    shadowOpacity: 0.06,
    elevation: 3,
  },
  identityCardPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  avatarText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  avatarTextActive: {
    color: '#FFFFFF',
  },
  identityInfo: {
    flex: 1,
    gap: 4,
  },
  identityName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  identityNameActive: {
    color: '#0F172A',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  infoChipActive: {
    backgroundColor: '#E2E8F0',
  },
  infoChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  infoChipTextActive: {
    color: '#0F172A',
  },
  infoChipAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  infoChipAccentActive: {
    backgroundColor: '#DBEAFE',
  },
  infoChipAccentText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#2563EB',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 8,
  },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  validationText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
    flex: 1,
  },
  button: {
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonPressed: {
    backgroundColor: '#1E293B',
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  buttonIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});