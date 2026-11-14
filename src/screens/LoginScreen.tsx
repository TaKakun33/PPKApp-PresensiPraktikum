// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Layar login (Firebase Auth).
// Peran ditentukan dari dokumen profil di Firestore, bukan dipilih di sini.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useScrollKeFieldFokus } from './useScrollKeFieldFokus';
import { getAuthErrorMessage } from '../services/authService';

type LoginRole = 'praktikan' | 'asisten';

export default function LoginScreen() {
  const { signIn, state, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('praktikan');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const insets = useSafeAreaInsets();
  const { scrollRef, saatLayoutForm, saatLayoutField, fokusKe } = useScrollKeFieldFokus();

  // Sudah login -> arahkan ke layar sesuai peran.
  if (state.status === 'authenticated') {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
  }

  const displayedError = error || authError || '';
  const submitLabel = role === 'asisten' ? 'Masuk sebagai Asisten' : 'Masuk sebagai Praktikan';

  const clearErrors = () => {
    setError('');
    clearAuthError();
  };

  const handleLogin = async () => {
    if (loading) return;
    clearErrors();
    if (!email.trim() || !password) {
      setError('Email dan password harus diisi.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Pengalihan ditangani otomatis begitu profil terbaca.
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e, 'Login gagal. Coba lagi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      {/* behavior="padding" di Android DAN iOS: Android edge-to-edge tidak me-resize jendela sendiri. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Selamat datang di aplikasi,</Text>
            <Text style={styles.heroTitle}>Praktikum Apps</Text>
            <Text style={styles.heroSubtitle}>
              Kelola jadwal, presensi, dan pengajuan izin praktikum dalam satu tempat.
            </Text>
          </View>

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 14, 28) }]}>
            <View style={styles.handle} />

            <View style={styles.roleSwitcher} accessibilityRole="tablist">
              {(['praktikan', 'asisten'] as const).map((item) => {
                const active = role === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setRole(item)}
                    style={[styles.roleOption, active && styles.roleOptionActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {item === 'praktikan' ? 'Praktikan' : 'Asisten'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.form} onLayout={saatLayoutForm}>
              <View style={styles.fieldGroup} onLayout={saatLayoutField('email')}>
                <Text style={styles.label}>Email Kampus</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="praktikan@kampus.ac.id"
                    placeholderTextColor={COLORS.muted}
                    value={email}
                    onFocus={() => fokusKe('email')}
                    onChangeText={(t) => {
                      setEmail(t);
                      clearErrors();
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup} onLayout={saatLayoutField('password')}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={COLORS.muted}
                    value={password}
                    onFocus={() => fokusKe('password')}
                    onChangeText={(t) => {
                      setPassword(t);
                      clearErrors();
                    }}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <Pressable
                    onPress={() => setShowPass((v) => !v)}
                    style={styles.eyeButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={COLORS.muted}
                    />
                  </Pressable>
                </View>
              </View>

              {displayedError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                  <Text style={styles.errorText}>{displayedError}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonPressed]}
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={loading ? 'Memproses' : submitLabel}
              >
                <Text style={styles.buttonText}>{loading ? 'Memproses...' : submitLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.demoText}>
                Akun demo terisi otomatis. Pilih role untuk melihat tampilan yang berbeda.
              </Text>
              <View style={styles.registerRow}>
                <Text style={styles.infoText}>Belum punya akun?</Text>
                <Link href="/register" style={styles.link}>
                  Daftar sekarang
                </Link>
              </View>
              <Text style={styles.copyright}>© 2026 created by Kelompok 5</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: COLORS.card, paddingBottom: 32 },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 66,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.78)',
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 39,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.white,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    maxWidth: 300,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.82)',
  },
  sheet: {
    marginTop: -34,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.card,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 22,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    marginBottom: 2,
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 13,
  },
  roleOptionActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  roleText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.muted,
  },
  roleTextActive: { color: COLORS.text, fontFamily: 'PlusJakartaSans_700Bold' },
  form: { gap: 16 },
  fieldGroup: { gap: 7 },
  label: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text,
  },
  inputBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingLeft: 15,
    paddingRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text,
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  eyeButton: {
    minHeight: 32,
    minWidth: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.white,
    paddingLeft: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.danger,
  },
  button: {
    marginTop: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.84 },
  buttonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
  },
  footer: { alignItems: 'center', gap: 10, paddingTop: 4 },
  demoText: {
    maxWidth: 300,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  link: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.primary,
  },
  copyright: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
});
