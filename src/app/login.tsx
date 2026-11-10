// FILE MILIK PM — layar login dengan Firebase Auth.
// Role ditentukan otomatis dari dokumen Firestore koleksi "users".
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau password salah.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi nanti.';
    case 'auth/network-request-failed':
      return 'Periksa koneksi internet kamu.';
    default:
      return 'Login gagal. Coba lagi.';
  }
}

export default function LoginScreen() {
  const { signIn, state, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Jika sudah login, arahkan ke layar sesuai peran.
  if (state.status === 'authenticated') {
    const role = state.profile.role;
    return <Redirect href={role === 'asisten' ? '/asisten/jadwal' : '/praktikan/jadwal'} />;
  }

  const displayedError = error || authError || '';

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Email dan password harus diisi.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // Redirect ditangani oleh index.tsx via onAuthStateChanged.
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(mapFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>PPKApp</Text>
            <Text style={styles.title}>Masuk ke Akun</Text>
            <Text style={styles.subtitle}>
              Login menggunakan akun yang telah didaftarkan oleh admin.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="email@contoh.com"
                  placeholderTextColor={COLORS.mutedLight}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.mutedLight}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Error */}
            {displayedError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}

            {/* Tombol Login */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (loading || pressed) && styles.buttonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Masuk"
            >
              <Text style={styles.buttonText}>
                {loading ? 'Memproses...' : 'Masuk'}
              </Text>
              {!loading && (
                <View style={styles.buttonIconBox}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                </View>
              )}
            </Pressable>
          </View>

          {/* Info bawah */}
          <Text style={styles.infoText}>
            Belum punya akun? Hubungi asisten atau admin untuk mendaftarkan akunmu.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 32,
  },
  header: { gap: 6 },
  appName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
    lineHeight: 20,
  },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text,
  },
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
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text,
    padding: 0,
  },
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
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.danger,
  },
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
  buttonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.white,
  },
  buttonIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

