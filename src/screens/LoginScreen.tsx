// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Layar login (Firebase Auth).
// Satu form login untuk semua pengguna: peran ditentukan dari dokumen profil di Firestore, bukan dipilih di sini.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link, Redirect } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
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

import { colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useScrollKeFieldFokus } from '../hooks/useScrollKeFieldFokus';
import { getAuthErrorMessage, sendPasswordReset } from '../services/authService';
import AuthLoadingGate from '../navigation/AuthLoadingGate';


export default function LoginScreen() {
  const { signIn, state, authError, profileError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [resetting, setResetting] = useState(false);
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
    setInfo('');
    clearAuthError();
  };

  // Lupa password: kirim tautan reset ke email yang sudah diketik di kolom email.
  const handleForgotPassword = async () => {
    if (resetting || loading) return;
    clearErrors();
    if (!email.trim()) {
      setError('Isi email kamu dulu, lalu tekan "Lupa password?".');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordReset(email);
      // Pesan sengaja netral supaya tidak membocorkan apakah email terdaftar atau tidak.
      setInfo('Jika email terdaftar, tautan untuk membuat password baru sudah dikirim. Cek inbox atau folder spam.');
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e, 'Gagal mengirim email reset. Coba lagi.'));
    } finally {
      setResetting(false);
    }
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
                <Ionicons name="mail-outline" size={18} color={colors.placeholder} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.placeholder}
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
                <Ionicons name="lock-closed-outline" size={18} color={colors.placeholder} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.placeholder}
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
                    color={colors.placeholder}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                onPress={handleForgotPassword}
                disabled={resetting || loading}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Lupa password"
              >
                <Text style={styles.forgotText}>
                  {resetting ? 'Mengirim...' : 'Lupa Password?'}
                </Text>
              </Pressable>
            </View>

            {info ? (
              <View style={styles.infoBox}>
                <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                <Text style={styles.infoBoxText}>{info}</Text>
              </View>
            ) : null}

            {displayedError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
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
              {busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : null}
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
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  photoFrame: {
    width: '100%',
    height: 190,
    borderRadius: 22,
    backgroundColor: colors.tint,
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
    color: colors.text,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textSecondary,
  },
  form: { marginTop: 30, gap: 14 },
  inputBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.text,
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
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.secondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successTint,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerTint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.danger,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.primary,
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
    color: colors.onPrimary,
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
    color: colors.textSecondary,
  },
  link: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.secondary,
  },
  copyright: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
  },
});
