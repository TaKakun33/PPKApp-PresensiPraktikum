// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Layar registrasi: peran, nama, NIM (praktikan), email, password.
// Peran asisten hanya berhasil jika email-nya terdaftar di `allowedAssistants` (diisi admin di Firebase Console).
// Tampilan mengikuti LoginScreen (header biru + sheet putih). Profil disimpan oleh authService.registerUser.
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

import type { Role } from '../lib/constants';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useScrollKeFieldFokus } from './useScrollKeFieldFokus';
import {
  PASSWORD_MIN,
  getAuthErrorMessage,
  validateRegisterInput,
  type RegisterErrors,
  type RegisterField,
} from '../services/authService';

export default function RegisterScreen() {
  const { register, state } = useAuth();
  const [role, setRole] = useState<Role>('praktikan');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nim, setNim] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const nimRef = useRef<ComponentRef<typeof TextInput>>(null);
  const insets = useSafeAreaInsets();
  const { scrollRef, saatLayoutForm, saatLayoutField, fokusKe } = useScrollKeFieldFokus();

  // Sudah login (termasuk setelah registrasi berhasil) -> arahkan ke layar sesuai peran.
  if (state.status === 'authenticated') {
    return <Redirect href={state.profile.role === 'asisten' ? '/asisten/jadwal' : '/praktikan/home'} />;
  }

  const clearField = (field: RegisterField) => {
    setFormError('');
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const pilihPeran = (r: Role) => {
    setRole(r);
    setFormError('');
    setFieldErrors((prev) => (prev.nim ? { ...prev, nim: undefined } : prev));
  };

  const handleRegister = async () => {
    if (submitting) return;
    setFormError('');

    const input = { role, nama, email, password, confirmPassword, nim };
    const errors = validateRegisterInput(input);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register(input);
      // Pengalihan ditangani otomatis begitu profil tersimpan dan terbaca.
    } catch (e: unknown) {
      setFormError(getAuthErrorMessage(e, 'Pendaftaran gagal. Coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = role === 'asisten' ? 'Daftar sebagai Asisten' : 'Daftar sebagai Praktikan';

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
            <Text style={styles.eyebrow}>Bergabung di aplikasi,</Text>
            <Text style={styles.heroTitle}>Buat Akun Baru</Text>
            <Text style={styles.heroSubtitle}>
              Pilih peranmu, lalu isi data untuk mulai mengelola jadwal, presensi, dan izin praktikum.
            </Text>
          </View>

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 14, 28) }]}>
            <View style={styles.handle} />

            {/* Peran */}
            <View style={styles.roleSwitcher} accessibilityRole="tablist">
              {(['praktikan', 'asisten'] as const).map((item) => {
                const active = role === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => pilihPeran(item)}
                    style={[styles.roleOption, active && styles.roleOptionActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Daftar sebagai ${item}`}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {item === 'praktikan' ? 'Praktikan' : 'Asisten'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.form} onLayout={saatLayoutForm}>
              {/* Nama */}
              <View style={styles.fieldGroup} onLayout={saatLayoutField('nama')}>
                <Text style={styles.label}>Nama lengkap</Text>
                <View style={[styles.inputBox, fieldErrors.nama && styles.inputBoxError]}>
                  <Ionicons name="person-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nama sesuai identitas"
                    placeholderTextColor={COLORS.muted}
                    value={nama}
                    onFocus={() => fokusKe('nama')}
                    onChangeText={(t) => {
                      setNama(t);
                      clearField('nama');
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => (role === 'praktikan' ? nimRef.current : emailRef.current)?.focus()}
                  />
                </View>
                {fieldErrors.nama ? <Text style={styles.fieldError}>{fieldErrors.nama}</Text> : null}
              </View>

              {/* NIM (hanya praktikan) */}
              {role === 'praktikan' ? (
                <View style={styles.fieldGroup} onLayout={saatLayoutField('nim')}>
                  <Text style={styles.label}>NIM</Text>
                  <View style={[styles.inputBox, fieldErrors.nim && styles.inputBoxError]}>
                    <Ionicons name="id-card-outline" size={18} color={COLORS.muted} />
                    <TextInput
                      ref={nimRef}
                      style={styles.input}
                      placeholder="Nomor induk mahasiswa"
                      placeholderTextColor={COLORS.muted}
                      value={nim}
                      onFocus={() => fokusKe('nim')}
                      onChangeText={(t) => {
                        setNim(t);
                        clearField('nim');
                      }}
                      keyboardType="number-pad"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>
                  {fieldErrors.nim ? <Text style={styles.fieldError}>{fieldErrors.nim}</Text> : null}
                </View>
              ) : null}

              {/* Email */}
              <View style={styles.fieldGroup} onLayout={saatLayoutField('email')}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputBox, fieldErrors.email && styles.inputBoxError]}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="email@kampus.ac.id"
                    placeholderTextColor={COLORS.muted}
                    value={email}
                    onFocus={() => fokusKe('email')}
                    onChangeText={(t) => {
                      setEmail(t);
                      clearField('email');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
                {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.fieldGroup} onLayout={saatLayoutField('password')}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputBox, fieldErrors.password && styles.inputBoxError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder={`Minimal ${PASSWORD_MIN} karakter`}
                    placeholderTextColor={COLORS.muted}
                    value={password}
                    onFocus={() => fokusKe('password')}
                    onChangeText={(t) => {
                      setPassword(t);
                      clearField('password');
                      clearField('confirmPassword');
                    }}
                    secureTextEntry={!showPass}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <Pressable
                    onPress={() => setShowPass((v) => !v)}
                    style={styles.eyeButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.muted} />
                  </Pressable>
                </View>
                {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
              </View>

              {/* Konfirmasi password */}
              <View style={styles.fieldGroup} onLayout={saatLayoutField('confirmPassword')}>
                <Text style={styles.label}>Ulangi password</Text>
                <View style={[styles.inputBox, fieldErrors.confirmPassword && styles.inputBoxError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="Ketik ulang password"
                    placeholderTextColor={COLORS.muted}
                    value={confirmPassword}
                    onFocus={() => fokusKe('confirmPassword')}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      clearField('confirmPassword');
                    }}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                </View>
                {fieldErrors.confirmPassword ? (
                  <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
                ) : null}
              </View>

              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={COLORS.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.button, (submitting || pressed) && styles.buttonPressed]}
                onPress={handleRegister}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={submitting ? 'Mendaftarkan' : submitLabel}
              >
                <Text style={styles.buttonText}>{submitting ? 'Mendaftarkan...' : submitLabel}</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.noteText}>
                {role === 'asisten'
                  ? 'Pendaftaran asisten hanya berhasil dengan email yang sudah didaftarkan admin.'
                  : 'Praktikan mendaftar dengan NIM. Jika kamu asisten, pilih "Asisten" dan pakai email yang didaftarkan admin.'}
              </Text>
              <View style={styles.loginRow}>
                <Text style={styles.infoText}>Sudah punya akun?</Text>
                <Link href="/login" style={styles.link}>
                  Masuk
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
  roleText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.muted },
  roleTextActive: { color: COLORS.text, fontFamily: 'PlusJakartaSans_700Bold' },
  form: { gap: 16 },
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  inputBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent', // ruang untuk garis error tanpa menggeser tata letak
    paddingLeft: 15,
    paddingRight: 15,
  },
  inputBoxError: { borderColor: COLORS.danger },
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
  fieldError: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.danger },
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
  errorText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.danger },
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
  buttonText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.white },
  footer: { alignItems: 'center', gap: 10, paddingTop: 4 },
  noteText: {
    maxWidth: 300,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.muted,
  },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  link: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.primary },
  copyright: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
});