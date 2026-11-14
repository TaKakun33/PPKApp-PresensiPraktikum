// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Layar registrasi: peran, nama, NIM (praktikan), email, password.
// Peran asisten hanya berhasil jika email-nya terdaftar di `allowedAssistants` (diisi admin di Firebase Console).
// Profil disimpan ke Firestore oleh authService.registerUser.
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

import type { Role } from '../app/constants';
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
  const { scrollRef, saatLayoutForm, saatLayoutField, fokusKe } = useScrollKeFieldFokus();

  // Sudah login (termasuk setelah registrasi berhasil) → arahkan ke layar sesuai peran.
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
            <Text style={styles.title}>Buat Akun Baru</Text>
            <Text style={styles.subtitle}>Pilih peran, lalu isi data di bawah untuk mendaftar.</Text>
          </View>

          <View style={styles.form} onLayout={saatLayoutForm}>
            {/* Peran */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Daftar sebagai</Text>
              <View style={styles.roleRow}>
                {(['praktikan', 'asisten'] as const).map((r) => {
                  const aktif = role === r;
                  return (
                    <Pressable
                      key={r}
                      style={[styles.roleChip, aktif && styles.roleChipActive]}
                      onPress={() => pilihPeran(r)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: aktif }}
                      accessibilityLabel={`Daftar sebagai ${r}`}
                    >
                      <Text style={[styles.roleChipText, aktif && styles.roleChipTextActive]}>
                        {r === 'praktikan' ? 'Praktikan' : 'Asisten'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Nama */}
            <View style={styles.fieldGroup} onLayout={saatLayoutField('nama')}>
              <Text style={styles.label}>Nama lengkap</Text>
              <View style={[styles.inputBox, fieldErrors.nama && styles.inputBoxError]}>
                <Ionicons name="person-outline" size={18} color={COLORS.muted} />
                <TextInput
                  style={styles.input}
                  placeholder="Nama sesuai identitas"
                  placeholderTextColor={COLORS.mutedLight}
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
                    placeholderTextColor={COLORS.mutedLight}
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
                  placeholder="email@contoh.com"
                  placeholderTextColor={COLORS.mutedLight}
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
                  placeholderTextColor={COLORS.mutedLight}
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
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} accessibilityLabel="Tampilkan password">
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.muted} />
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
                  placeholderTextColor={COLORS.mutedLight}
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
              {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}
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
              accessibilityLabel="Daftar"
            >
              <Text style={styles.buttonText}>{submitting ? 'Mendaftarkan...' : 'Daftar'}</Text>
            </Pressable>
          </View>

          <View style={styles.catatanBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
            <Text style={styles.catatanText}>
              {role === 'asisten'
                ? 'Pendaftaran asisten hanya berhasil dengan email yang sudah didaftarkan admin. Gunakan email tersebut.'
                : 'Praktikan mendaftar dengan NIM. Jika kamu asisten, pilih "Asisten" dan pakai email yang didaftarkan admin.'}
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.infoText}>Sudah punya akun?</Text>
            <Link href="/login" style={styles.link}>
              Masuk
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 28 },
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
  inputBoxError: { borderColor: COLORS.danger },
  input: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text, padding: 0 },
  fieldError: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.danger },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  roleChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  roleChipText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.muted },
  roleChipTextActive: { color: COLORS.primary },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.white },
  catatanBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  catatanText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  link: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.primary },
});
