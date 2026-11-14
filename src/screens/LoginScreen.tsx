// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Layar login (Firebase Auth).
// Satu form login untuk semua pengguna: peran ditentukan dari dokumen profil di Firestore, bukan dipilih di sini.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link, Redirect } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import AuthLoadingGate from '../navigation/AuthLoadingGate';

const NAVY = '#0B2447';
const INPUT_BG = '#F5F6F8';
const MUTED_TEXT = '#8A8F98';

export default function LoginScreen() {
  const { signIn, state, authError, profileError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const insets = useSafeAreaInsets();
  const { scrollRef, saatLayoutForm, saatLayoutField, fokusKe } = useScrollKeFieldFokus();

  // Sudah login tetapi profil belum terbaca (mis. koneksi lambat): tampilkan pesan + Coba lagi / Keluar.
  if (state.status === 'loading' && profileError) return <AuthLoadingGate />;

  // Sudah login -> arahkan ke layar sesuai peran.
  if (state.status === 'authenticated') {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
  }

  const displayedError = error || authError || '';
  // Setelah signIn berhasil, `loading` sengaja TIDAK dimatikan: tombol tetap "Memproses" sampai layar ini
  // dilepas oleh Redirect. Kalau login berhasil tetapi profil gagal dimuat (authError terisi, pengguna
  // dikeluarkan), tombol diaktifkan lagi supaya bisa mencoba ulang.
  const busy = loading && !authError;

  const clearErrors = () => {
    setError('');
    clearAuthError();
  };

  const handleLogin = async () => {
    if (busy) return;
    clearErrors();
    if (!email.trim() || !password) {
      setError('Email dan password harus diisi.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Pengalihan ditangani otomatis begitu profil terbaca; `loading` tetap aktif sampai saat itu.
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e, 'Login gagal. Coba lagi.'));
      setLoading(false);
    }
  };

  const handleLupaPassword = () => {
    Alert.alert(
      'Lupa Password',
      'Fitur atur ulang password belum tersedia. Hubungi admin praktikum untuk bantuan.',
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      {/* behavior="padding" di Android DAN iOS: Android edge-to-edge tidak me-resize jendela sendiri. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Image
            source={require('../../assets/images/4598597536534242688.jpg')}
            style={styles.photoFrame}
            contentFit="cover"
            accessibilityLabel="Ilustrasi kelas praktikum"
          />

          <View style={styles.brand}>
            <Text style={styles.heroTitle}>Praktikum Apps</Text>
            <Text style={styles.heroSubtitle}>Jadwal, Presensi, &amp; Perizinan Praktikum</Text>
          </View>

          <View style={styles.form} onLayout={saatLayoutForm}>
            <View onLayout={saatLayoutField('email')}>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={MUTED_TEXT} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={MUTED_TEXT}
                  value={email}
                  onFocus={() => fokusKe('email')}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearErrors();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  // Autofill: pengelola password di HP (Google/Samsung) menampilkan email yang tersimpan.
                  autoComplete="email"
                  textContentType="username"
                  importantForAutofill="yes"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            <View onLayout={saatLayoutField('password')}>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={MUTED_TEXT} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={MUTED_TEXT}
                  value={password}
                  onFocus={() => fokusKe('password')}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearErrors();
                  }}
                  secureTextEntry={!showPass}
                  autoComplete="current-password"
                  textContentType="password"
                  importantForAutofill="yes"
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
                    color={MUTED_TEXT}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRemember((v) => !v)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
                accessibilityLabel="Ingat Saya"
              >
                <Ionicons
                  name={remember ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={remember ? NAVY : COLORS.borderLight}
                />
                <Text style={styles.rememberText}>Ingat Saya</Text>
              </Pressable>

              <Pressable onPress={handleLupaPassword} hitSlop={8} accessibilityRole="link">
                <Text style={styles.forgotText}>Lupa Password?</Text>
              </Pressable>
            </View>

            {displayedError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonPressed]}
              onPress={handleLogin}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Memproses' : 'Masuk'}
            >
              {busy ? <ActivityIndicator size="small" color={COLORS.white} /> : null}
              <Text style={styles.buttonText}>{busy ? 'Memproses...' : 'Masuk'}</Text>
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={styles.infoText}>Belum punya akun?</Text>
              <Link href="/register" style={styles.link}>
                Daftar sekarang
              </Link>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.copyright}>© 2026 created by Kelompok 5</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  photoFrame: {
    width: '100%',
    height: 190,
    borderRadius: 22,
    backgroundColor: '#F1F2F4',
  },
  brand: {
    marginTop: 26,
    alignItems: 'center',
    gap: 6,
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: NAVY,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: MUTED_TEXT,
  },
  form: { marginTop: 30, gap: 14 },
  inputBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: NAVY,
    paddingVertical: 13,
    paddingHorizontal: 0,
  },
  eyeButton: {
    minHeight: 32,
    minWidth: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.textSecondary,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: NAVY,
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
    marginTop: 8,
    backgroundColor: NAVY,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonPressed: { opacity: 0.84 },
  buttonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.white,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
    gap: 10,
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
    color: MUTED_TEXT,
  },
  link: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: NAVY,
  },
  copyright: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: MUTED_TEXT,
  },
});
