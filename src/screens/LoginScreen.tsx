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
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useScrollKeFieldFokus } from './useScrollKeFieldFokus';
import { getAuthErrorMessage } from '../services/authService';

export default function LoginScreen() {
  const { signIn, state, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { scrollRef, saatLayoutForm, saatLayoutField, fokusKe } = useScrollKeFieldFokus();

  // Sudah login → arahkan ke layar sesuai peran.
  if (state.status === 'authenticated') {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/jadwal'} />;
  }

  const displayedError = error || authError || '';

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
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
            <Text style={styles.appName}>PPKApp</Text>
            <Text style={styles.title}>Masuk ke Akun</Text>
            <Text style={styles.subtitle}>Login untuk melihat jadwal, presensi, dan pengajuan izin praktikum.</Text>
          </View>

          <View style={styles.form} onLayout={saatLayoutForm}>
            <View style={styles.fieldGroup} onLayout={saatLayoutField('email')}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="email@contoh.com"
                  placeholderTextColor={COLORS.mutedLight}
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
                  placeholderTextColor={COLORS.mutedLight}
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
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} accessibilityLabel="Tampilkan password">
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.muted} />
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
              accessibilityLabel="Masuk"
            >
              <Text style={styles.buttonText}>{loading ? 'Memproses...' : 'Masuk'}</Text>
              {!loading && (
                <View style={styles.buttonIconBox}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.infoText}>Belum punya akun?</Text>
            <Link href="/register" style={styles.link}>
              Daftar sekarang
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48, gap: 32 },
  header: { gap: 6 },
  appName: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.primary, letterSpacing: 0.5 },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 20 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text, padding: 0 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.danger },
  button: {
    marginTop: 4,
    backgroundColor: COLORS.text,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.white },
  buttonIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  link: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.primary },
});
